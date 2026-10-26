import { beforeEach, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { initDatabase } from "@repo/data-ops/database/setup";
import { exportEvents } from "../../web/src/core/lib/export-events";

const projectId = "11111111-1111-4111-8111-111111111111";
beforeEach(async () => {
  await env.DB.prepare("INSERT INTO auth_user(id,name,email) VALUES ('user','Test','test@example.com')").run();
  await env.DB.prepare("INSERT INTO projects(id,user_id,name) VALUES (?,'user','Test')").bind(projectId).run();
});
it("streams stable IDs through equal timestamps and concurrent inserts", async () => {
  const snapshot = Date.now();
  await env.DB.batch(Array.from({ length: 205 }, (_, i) => env.DB.prepare("INSERT INTO events(id,project_id,timestamp,ip_address,type) VALUES (?,?,?,'198.51.100.1','unknown')").bind(String(i).padStart(4, "0"), projectId, snapshot - 1000)));
  const reader = exportEvents(initDatabase(env.DB), { projectId, range: "day", columns: ["timestamp", "ipAddress"] }, new AbortController().signal, snapshot).getReader();
  const decoder = new TextDecoder(); let output = "";
  output += decoder.decode((await reader.read()).value);
  output += decoder.decode((await reader.read()).value);
  await env.DB.prepare("INSERT INTO events(id,project_id,timestamp,ip_address,type) VALUES ('new',?,?,'198.51.100.1','unknown')").bind(projectId, snapshot + 1).run();
  while (true) { const { value, done } = await reader.read(); if (done) break; output += decoder.decode(value); }
  const rows = JSON.parse(output) as { id: string }[];
  expect(rows).toHaveLength(205);
  expect(new Set(rows.map(row => row.id)).size).toBe(205);
  expect(rows[0]?.id).toBe("0204"); expect(rows.at(-1)?.id).toBe("0000");
});
it("filters dates, retention and literal searches in SQL and isolates projects", async () => {
  const now = Date.now();
  await env.DB.prepare("INSERT INTO projects(id,user_id,name) VALUES ('other','user','Other')").run();
  for (const [id, project, time] of [["recent", projectId, now - 1000], ["expired", projectId, now - 2 * 86400000], ["future", projectId, now + 1000], ["other-project", "other", now - 1000]] as const) {
    await env.DB.prepare("INSERT INTO events(id,project_id,timestamp,ip_address,type) VALUES (?,?,?,'198.51.100.1','unknown')").bind(id, project, time).run();
  }
  const download = (search?: string) => new Response(exportEvents(initDatabase(env.DB), { projectId, range: "all", columns: ["timestamp"], search }, new AbortController().signal, now, 1)).json();
  expect(await download()).toEqual([expect.objectContaining({ id: "recent" })]);
  expect(await download("%")).toEqual([]);
});
it("uses the composite project/time index for date-window history", async () => {
  // Representative mixed history: the range query must avoid a full scan or
  // a separate sort even after history extends beyond the current window.
  await env.DB.batch(Array.from({ length: 2000 }, (_, i) => env.DB.prepare("INSERT INTO events(id,project_id,timestamp,ip_address,type) VALUES (?,?,?,'198.51.100.1','unknown')").bind(`history-${i}`, projectId, Date.now() - i * 3600000)));
  const plan = await env.DB.prepare("EXPLAIN QUERY PLAN SELECT * FROM events WHERE project_id = ? AND timestamp >= ? AND timestamp < ? ORDER BY timestamp DESC, id DESC LIMIT 100").bind(projectId, Date.now() - 86400000, Date.now()).all<{ detail: string }>();
  expect(plan.results.some(row => row.detail.includes("events_project_time_id_idx"))).toBe(true);
  expect(plan.results.some(row => row.detail.includes("TEMP B-TREE"))).toBe(false);
});
