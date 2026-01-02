// packages/data-ops/config/auth.ts
import { createBetterAuth } from "../src/auth/setup";
import Database from "better-sqlite3";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// For CLI use - uses dummy SQLite database
export const auth = createBetterAuth({
  database: drizzleAdapter(new Database("./config/test.sqlite"), {
    provider: "sqlite",
  }),
});
