import { env } from "cloudflare:test";
import { expect, it } from "vitest";
it("applies the documented local seed repeatedly to the migrated database", async () => {
  for (let i = 0; i < 2; i++) {
    const statements = env.TEST_SEED_SQL.replace(/^--.*$/gm, "").split(";").map(query => query.trim()).filter(Boolean);
    await env.DB.batch(statements.map(query => env.DB.prepare(query)));
  }
  expect(await env.DB.prepare("SELECT p.name, d.hostname FROM projects p JOIN project_domains d ON d.project_id = p.id").first()).toMatchObject({ name: "Local collector sample", hostname: "localhost" });
});
