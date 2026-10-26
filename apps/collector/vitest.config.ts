import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export default defineWorkersConfig(async () => ({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    setupFiles: ["./test/setup.ts"],
    poolOptions: { workers: {
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations("../../packages/data-ops/src/drizzle"), TEST_SEED_SQL: await readFile("../../scripts/seed-local.sql", "utf8") } },
    } },
  },
}));
