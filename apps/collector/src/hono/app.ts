import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { eq, and, sql } from "drizzle-orm";
import { initDatabase } from "@repo/data-ops/database/setup";
import { events, projectDomains, projects, ingestionDiagnostics } from "@repo/data-ops/drizzle/schema";
import { CollectorEventRequestSchema } from "@repo/data-ops/zod-schema/collector";
import { getClientIp, getEdgeLocation, getRequestHostname, matchesDomain } from "../lib/visitor";
import { collectorScript } from "../lib/script";

export const app = new Hono<{ Bindings: Env }>();
app.use("/events", cors({ origin: "*", allowMethods: ["POST", "OPTIONS"], allowHeaders: ["content-type"] }));
app.use("/events", bodyLimit({ maxSize: 2048, onError: c => c.json({ error: "Payload exceeds 2 KB" }, 413) }));
app.get("/", c => c.json({ status: "ok" }));
app.get("/main.js", c => c.text(collectorScript, 200, {
  "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300",
}));
app.onError((error, c) => {
  console.error(JSON.stringify({ event: "collector_error", message: error.message }));
  return c.json({ error: "Unable to store event" }, 503);
});

app.post("/events", async c => {
  let payload: unknown;
  try { payload = await c.req.json(); } catch (error) {
    if (error instanceof Error && error.name === "BodyLimitError") return c.json({ error: "Payload exceeds 2 KB" }, 413);
    return c.json({ error: "Invalid JSON payload" }, 400);
  }
  const parsed = CollectorEventRequestSchema.safeParse(payload);
  if (!parsed.success) return c.json({ error: "Invalid project ID, event ID, or timestamp" }, 400);
  const { projectId, timestamp, eventId: clientEventId } = parsed.data;
  const now = Date.now();
  const db = initDatabase(c.env.DB);
  const project = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get();
  if (!project) return c.json({ error: "Project not found" }, 404);

  const reject = async (reason: string, status: 400 | 403 | 429) => {
    await db.insert(ingestionDiagnostics).values({ projectId, day: Math.floor(now / 86400000), reason, count: 1, lastAt: now })
      .onConflictDoUpdate({ target: [ingestionDiagnostics.projectId, ingestionDiagnostics.day, ingestionDiagnostics.reason],
        set: { count: sql`${ingestionDiagnostics.count} + 1`, lastAt: now } });
    console.log(JSON.stringify({ event: "event_rejected", projectId, reason }));
    if (status === 429) c.header("Retry-After", "60");
    return c.json({ error: reason }, status);
  };
  const ipAddress = getClientIp(c.req.raw);
  if (!ipAddress) return reject("Missing trusted client IP", 400);
  const hostname = getRequestHostname(c.req.raw);
  const domains = await db.select().from(projectDomains).where(eq(projectDomains.projectId, projectId));
  if (!hostname || !domains.some(d => matchesDomain(hostname, d.hostname, d.wildcard))) return reject("Hostname not allowed for project", 403);
  if (timestamp !== undefined && Math.abs(now - timestamp) > 5 * 60 * 1000) return reject("Client timestamp differs by more than five minutes", 400);

  // D1 serializes each SQL statement: quota checks and insert happen atomically.
  // Legacy clients can omit eventId; new scripts reuse an ID for every retry.
  const id = crypto.randomUUID();
  const location = getEdgeLocation(c.req.raw.cf);
  const status = c.env.IP_API_KEY ? "pending" : (location.country ? "edge" : "unavailable");
  const result = await c.env.DB.prepare(`INSERT INTO events
    (id, project_id, timestamp, ip_address, client_event_id, client_timestamp, type,
     lat, lon, country, region, city, zip, isp, as_name, enrichment_status)
    SELECT ?, ?, ?, ?, ?, ?, 'unknown', ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE (SELECT count(*) FROM events WHERE project_id = ? AND timestamp >= ? AND timestamp <= ?) < 1000
      AND (SELECT count(*) FROM events WHERE project_id = ? AND ip_address = ? AND timestamp >= ? AND timestamp <= ?) < 60
    ON CONFLICT(project_id, client_event_id) DO NOTHING`)
    .bind(id, projectId, now, ipAddress, clientEventId ?? null, timestamp ?? null,
      location.lat, location.lon, location.country, location.region, location.city, location.zip, location.isp, location.asName, status,
      projectId, now - 60000, now, projectId, ipAddress, now - 60000, now).run();
  if (!result.meta.changes) {
    const duplicate = clientEventId ? await db.select({ id: events.id }).from(events)
      .where(and(eq(events.projectId, projectId), eq(events.clientEventId, clientEventId))).get() : undefined;
    if (duplicate) return c.json({ id: duplicate.id, duplicate: true }, 200);
    return reject("Ingestion rate limit reached", 429);
  }
  return c.json({ id }, 201);
});
