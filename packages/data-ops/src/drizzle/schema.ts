import { sqliteTable, text, integer, index, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { auth_user } from "./auth-schema";

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => auth_user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address").notNull(),
    type: text("type").notNull(),
    lat: real("lat"),
    lon: real("lon"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    zip: text("zip"),
    isp: text("isp"),
    asName: text("as_name"),
  },
  (table) => [
    index("events_project_id_idx").on(table.projectId),
    index("events_timestamp_idx").on(table.timestamp),
  ],
);

export const projectDomains = sqliteTable(
  "project_domains",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    wildcard: integer("wildcard", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    index("project_domains_project_id_idx").on(table.projectId),
    index("project_domains_hostname_idx").on(table.hostname),
  ],
);
