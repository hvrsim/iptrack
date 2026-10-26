import { drizzle } from "drizzle-orm/d1";

export function initDatabase(d1Db: D1Database) {
  return drizzle(d1Db);
}
