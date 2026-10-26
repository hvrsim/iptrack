import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { app } from "../src/hono/app";
import { getClientIp, getEdgeLocation, getEventType, matchesDomain } from "../src/lib/visitor";
import { maintain } from "../src/lib/maintenance";
import { CollectorEventRequestSchema } from "@repo/data-ops/zod-schema/collector";

const projectId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
beforeEach(async () => {
  await env.DB.prepare("INSERT INTO auth_user(id,name,email) VALUES ('user','Test','test@example.com')").run();
  await env.DB.prepare("INSERT INTO projects(id,user_id,name) VALUES (?,'user','Test')").bind(projectId).run();
  await env.DB.prepare("INSERT INTO project_domains(id,project_id,hostname,wildcard) VALUES ('domain',?,'example.com',0)").bind(projectId).run();
});
const send = (data: unknown = { projectId, eventId, timestamp: Date.now() }, headers: Record<string, string> = {}, bindings: Env = env) => app.request("https://collector.example/events", {
  method: "POST", headers: { "content-type": "application/json", Origin: "https://example.com", "CF-Connecting-IP": "198.51.100.5", ...headers }, body: JSON.stringify(data),
}, bindings);

describe("collector boundaries", () => {
  it("ignores custom IPv4 and forwarded-for identities", () => {
    const request = new Request("https://collector.example", { headers: { "CF-Connecting-IP": "198.51.100.5", "CF-Connecting-IPV4": "203.0.113.9" } });
    expect(getClientIp(request)).toBe("198.51.100.5");
    expect(getClientIp(new Request(request.url, { headers: { "X-Forwarded-For": "203.0.113.9" } }))).toBeUndefined();
  });
  it("handles pseudo IPv4 only when appropriate", () => {
    expect(getClientIp(new Request("https://example.com", { headers: { "CF-Connecting-IP": "240.1.2.3", "CF-Connecting-IPv6": "2001:db8::1" } }))).toBe("2001:db8::1");
    expect(getClientIp(new Request("https://example.com", { headers: { "CF-Connecting-IP": "198.51.100.5", "CF-Connecting-IPv6": "2001:db8::1" } }))).toBe("198.51.100.5");
  });
  it("separates residential, hosting, unknown and overlapping flags", () => {
    expect(getEventType({ proxy: false, mobile: false, hosting: false })).toBe("residential");
    expect(getEventType({ proxy: null, mobile: null, hosting: null })).toBe("unknown");
    expect(getEventType({ proxy: false, mobile: false, hosting: true })).toBe("hosting");
    expect(getEventType({ proxy: true, mobile: true, hosting: false })).toBe("proxy");
  });
  it.each([null, "", true, 1e100, -1, 1.5])("rejects malformed timestamps %s", timestamp => {
    expect(CollectorEventRequestSchema.safeParse({ projectId, timestamp }).success).toBe(false);
  });
  it("uses edge metadata without inventing coordinates or classification", () => {
    expect(getEdgeLocation(undefined)).toMatchObject({ lat: null, lon: null, country: null });
    expect(getEdgeLocation({ latitude: "12.5", longitude: "-32", country: "US", asOrganization: "Example" })).toMatchObject({ lat: 12.5, lon: -32, country: "US", asName: "Example" });
    expect(getEdgeLocation({ latitude: "200", longitude: "" })).toMatchObject({ lat: null, lon: null });
  });
  it("checks domain label boundaries", () => {
    expect(matchesDomain("a.example.com", "example.com", true)).toBe(true);
    expect(matchesDomain("notexample.com", "example.com", true)).toBe(false);
    expect(matchesDomain("a.example.com", "example.com", false)).toBe(false);
  });
  it("saves receipt time and unknown flags without any network lookup", async () => {
    const start = Date.now();
    expect((await send({ projectId, timestamp: start - 60000 })).status).toBe(201);
    const row = await env.DB.prepare("SELECT * FROM events").first();
    expect(row?.timestamp).toBeGreaterThanOrEqual(start);
    expect(row?.client_timestamp).toBe(start - 60000);
    expect(row?.type).toBe("unknown"); expect(row?.mobile).toBeNull();
  });
  it("deduplicates retries without discarding different documents", async () => {
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(200);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM events").first())?.n).toBe(1);
    expect((await send({ projectId, eventId: crypto.randomUUID() })).status).toBe(201);
  });
  it("rejects disallowed domains, skew, missing identity, and oversized bodies", async () => {
    expect((await send(undefined, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await send({ projectId, timestamp: Date.now() + 600000 })).status).toBe(400);
    expect((await send(undefined, { "CF-Connecting-IP": "" })).status).toBe(400);
    expect((await send({ projectId, junk: "x".repeat(3000) })).status).toBe(413);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM ingestion_diagnostics").first())?.n).toBe(3);
  });
  it("atomically limits one visitor to 60 events/minute", async () => {
    for (let i = 0; i < 60; i++) expect((await send({ projectId, eventId: crypto.randomUUID() })).status).toBe(201);
    expect((await send({ projectId, eventId: crypto.randomUUID() })).status).toBe(429);
    // A retry of an existing event must succeed even at the quota.
    const row = await env.DB.prepare("SELECT client_event_id FROM events LIMIT 1").first<{client_event_id:string}>();
    expect((await send({ projectId, eventId: row!.client_event_id })).status).toBe(200);
  });
  it("enforces the project quota across different visitors", async () => {
    const now = Date.now();
    await env.DB.batch(Array.from({ length: 1000 }, (_, i) => env.DB.prepare("INSERT INTO events(id,project_id,timestamp,ip_address,type) VALUES (?,?,?,?,'unknown')").bind(`seed-${i}`, projectId, now, `198.51.100.${Math.floor(i / 50)}`)));
    expect((await send({ projectId, eventId: crypto.randomUUID() }, { "CF-Connecting-IP": "203.0.113.10" })).status).toBe(429);
  });
  it("honors provider throttling without retrying until reset", async () => {
    await send(undefined, {}, { ...env, IP_API_KEY: "test-key" });
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 429, headers: { "X-Ttl": "120", "X-Rl": "0" } }));
    try {
      const now = Date.now();
      await maintain({ ...env, IP_API_KEY: "test-key" }, now);
      await maintain({ ...env, IP_API_KEY: "test-key" }, now + 60000);
      expect(fetch).toHaveBeenCalledOnce();
      expect((await env.DB.prepare("SELECT enrichment_status FROM events").first())?.enrichment_status).toBe("pending");
    } finally { fetch.mockRestore(); }
  });
  it("stops enrichment after five failures, preserving the stored event", async () => {
    await send(undefined, {}, { ...env, IP_API_KEY: "test-key" });
    await env.DB.prepare("UPDATE events SET enrichment_attempts = 4").run();
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    try {
      await maintain({ ...env, IP_API_KEY: "test-key" });
      expect(await env.DB.prepare("SELECT enrichment_status, enrichment_attempts FROM events").first()).toMatchObject({ enrichment_status: "failed", enrichment_attempts: 5 });
      await maintain({ ...env, IP_API_KEY: "test-key" }, Date.now() + 86400000);
      expect(fetch).toHaveBeenCalledOnce();
    } finally { fetch.mockRestore(); }
  });
  it("purges expired events, cache and diagnostics on schedule", async () => {
    await send();
    await env.DB.prepare("UPDATE events SET timestamp = ?").bind(Date.now() - 31 * 86400000).run();
    await env.DB.prepare("INSERT INTO enrichment_cache VALUES ('198.51.100.5','{}',0)").run();
    await maintain(env);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM events").first())?.n).toBe(0);
    expect((await env.DB.prepare("SELECT count(*) AS n FROM enrichment_cache").first())?.n).toBe(0);
  });
  it("durably retries failed optional enrichment", async () => {
    await send(undefined, {}, { ...env, IP_API_KEY: "test-key" });
    // An already aborted response simulates a provider timeout without a real network call.
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    try {
      await maintain({ ...env, IP_API_KEY: "test-key" });
      const row = await env.DB.prepare("SELECT enrichment_status, enrichment_attempts, type FROM events").first();
      expect(row).toMatchObject({ enrichment_status: "pending", enrichment_attempts: 1, type: "unknown" });
      expect(fetch).toHaveBeenCalledOnce();
    } finally { fetch.mockRestore(); }
  });
  it("enriches overlapping flags and caches the provider response", async () => {
    await send(undefined, {}, { ...env, IP_API_KEY: "test-key" });
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ status: "success", proxy: true, mobile: true, hosting: false,
      lat: 10, lon: 20, country: "Test", regionName: "Region", city: "City", zip: "123", isp: "ISP", as: "AS1" }));
    try {
      await maintain({ ...env, IP_API_KEY: "test-key" });
      expect(await env.DB.prepare("SELECT type,mobile,proxy,hosting,enrichment_status FROM events").first()).toMatchObject({ type: "proxy", mobile: 1, proxy: 1, hosting: 0, enrichment_status: "complete" });
      const cache = await env.DB.prepare("SELECT expires_at FROM enrichment_cache WHERE ip_address = '198.51.100.5'").first();
      await send({ projectId, eventId: crypto.randomUUID() }, {}, { ...env, IP_API_KEY: "test-key" });
      await maintain({ ...env, IP_API_KEY: "test-key" }, Date.now() + 60000);
      expect(fetch).toHaveBeenCalledOnce();
      expect((await env.DB.prepare("SELECT expires_at FROM enrichment_cache WHERE ip_address = '198.51.100.5'").first())?.expires_at).toBe(cache?.expires_at);
    } finally { fetch.mockRestore(); }
  });
});

it("does not recreate cached IP data after an event is deleted during lookup", async () => {
  await send(undefined, {}, { ...env, IP_API_KEY: "test-key" });
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    await env.DB.prepare("DELETE FROM events").run();
    return Response.json({ status: "success", proxy: false, mobile: false, hosting: false,
      lat: 10, lon: 20, country: "Test", regionName: "Region", city: "City", zip: "123", isp: "ISP", as: "AS1" });
  });
  try {
    await maintain({ ...env, IP_API_KEY: "test-key" });
    expect((await env.DB.prepare("SELECT count(*) AS n FROM enrichment_cache").first())?.n).toBe(0);
  } finally { fetch.mockRestore(); }
});
it("migration preserves known legacy flags and removes invented hosting labels", async () => {
  for (const type of ["hosting", "proxy", "mobile"]) {
    await env.DB.prepare("INSERT INTO events(id,project_id,timestamp,ip_address,type) VALUES (?,?,?,'198.51.100.1',?)").bind(type, projectId, Date.now(), type).run();
  }
  const migration = env.TEST_MIGRATIONS.find(item => item.name.includes("0004"))!;
  const backfill = migration.queries.find(query => query.includes("UPDATE events SET proxy"))!;
  expect(backfill).toBeTruthy();
  await env.DB.prepare(backfill).run();
  const rows = await env.DB.prepare("SELECT id,type,proxy,mobile,hosting,enrichment_status FROM events ORDER BY id").all();
  expect(rows.results).toEqual([
    { id: "hosting", type: "unknown", proxy: null, mobile: null, hosting: null, enrichment_status: "legacy" },
    { id: "mobile", type: "mobile", proxy: null, mobile: 1, hosting: null, enrichment_status: "legacy" },
    { id: "proxy", type: "proxy", proxy: 1, mobile: null, hosting: null, enrichment_status: "legacy" },
  ]);
});
