import { initDatabase } from "@repo/data-ops/database/setup";
import { enrichmentCache, events } from "@repo/data-ops/drizzle/schema";
import { IpEnrichmentSchema } from "@repo/data-ops/zod-schema/collector";
import { and, eq, lte, sql } from "drizzle-orm";
import { getEventType } from "./visitor";

export async function maintain(env: Env, now = Date.now()) {
  // Purging is independent of the optional provider's availability.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM events WHERE id IN (
      SELECT e.id FROM events e JOIN projects p ON e.project_id = p.id
      WHERE e.timestamp < ? - p.retention_days * 86400000 LIMIT 5000)`).bind(now),
    env.DB.prepare("DELETE FROM enrichment_cache WHERE expires_at <= ?").bind(now),
    env.DB.prepare("DELETE FROM ingestion_diagnostics WHERE day < ?").bind(Math.floor(now / 86400000) - 30),
  ]);
  if (!env.IP_API_KEY) return;
  const db = initDatabase(env.DB);
  const block = await db.select().from(enrichmentCache).where(eq(enrichmentCache.ipAddress, "provider-backoff")).get();
  if (block && block.expiresAt > now) return;
  // Bounded batch; each fetch is bounded by a three second timeout. Events
  // remain a durable outbox until complete or five attempts have failed.
  const pending = await db.select().from(events).where(and(eq(events.enrichmentStatus, "pending"), lte(events.nextEnrichmentAt, now))).limit(10);
  for (const event of pending) {
    const cached = await db.select().from(enrichmentCache).where(eq(enrichmentCache.ipAddress, event.ipAddress)).get();
    let value: unknown;
    const fromCache = Boolean(cached && cached.expiresAt > now);
    try {
      if (cached && cached.expiresAt > now) value = JSON.parse(cached.payload);
      else {
        const response = await fetch(`https://pro.ip-api.com/json/${encodeURIComponent(event.ipAddress)}?key=${encodeURIComponent(env.IP_API_KEY)}&fields=status,country,regionName,city,zip,isp,as,lat,lon,proxy,mobile,hosting`, { signal: AbortSignal.timeout(3000) });
        const remaining = response.headers.get("X-Rl");
        if (response.status === 429 || remaining === "0") {
          const ttl = Math.min(3600, Math.max(60, Number(response.headers.get("X-Ttl")) || 60));
          await db.insert(enrichmentCache).values({ ipAddress: "provider-backoff", payload: "{}", expiresAt: now + ttl * 1000 })
            .onConflictDoUpdate({ target: enrichmentCache.ipAddress, set: { expiresAt: now + ttl * 1000 } });
          if (!response.ok) return;
        }
        if (!response.ok) throw new Error("Provider request failed");
        // Limit response buffering even if the upstream service misbehaves.
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing provider response");
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const { value: chunk, done } = await reader.read();
            if (done) break;
            length += chunk.length;
            if (length > 16384) throw new Error("Provider response too large");
            chunks.push(chunk);
          }
        } finally { await reader.cancel(); }
        const buffer = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
        value = JSON.parse(new TextDecoder().decode(buffer));
      }
      const info = IpEnrichmentSchema.parse(value);
      const update = db.update(events).set({
        type: getEventType(info), proxy: info.proxy, mobile: info.mobile, hosting: info.hosting,
        lat: info.lat, lon: info.lon, country: info.country, region: info.regionName,
        city: info.city, zip: info.zip, isp: info.isp, asName: info.as,
        enrichmentStatus: "complete", enrichmentAttempts: event.enrichmentAttempts + 1,
      }).where(eq(events.id, event.id));
      if (fromCache) await update;
      else {
        // The cache lifetime is measured from lookup, never extended on hits.
        // Conditional insertion and the event update share a transaction, so
        // deleting events cannot race with a late provider response and
        // recreate their cached IP data.
        const cacheWrite = db.insert(enrichmentCache).select(db.select({
          ipAddress: sql<string>`${event.ipAddress}`.as("ip_address"),
          payload: sql<string>`${JSON.stringify(info)}`.as("payload"),
          expiresAt: sql<number>`${now + 86400000}`.as("expires_at"),
        }).from(events).where(eq(events.id, event.id)))
          .onConflictDoUpdate({ target: enrichmentCache.ipAddress, set: { payload: JSON.stringify(info), expiresAt: now + 86400000 } });
        await db.batch([cacheWrite, update]);
      }
      const backoff = await db.select().from(enrichmentCache).where(eq(enrichmentCache.ipAddress, "provider-backoff")).get();
      if (backoff && backoff.expiresAt > now) return;
    } catch {
      const attempts = event.enrichmentAttempts + 1;
      await db.update(events).set({ enrichmentAttempts: attempts,
        enrichmentStatus: attempts >= 5 ? "failed" : "pending", nextEnrichmentAt: now + 60000 * 2 ** attempts,
      }).where(eq(events.id, event.id));
      console.warn(JSON.stringify({ event: "enrichment_failed", eventId: event.id, attempts }));
    }
  }
}
