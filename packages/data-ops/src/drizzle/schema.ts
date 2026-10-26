import { sqliteTable, text, integer, index, real, uniqueIndex } from "drizzle-orm/sqlite-core";
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
    retentionDays: integer("retention_days").notNull().default(30),
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
    clientEventId: text("client_event_id"),
    clientTimestamp: integer("client_timestamp", { mode: "timestamp_ms" }),
    proxy: integer("proxy", { mode: "boolean" }),
    mobile: integer("mobile", { mode: "boolean" }),
    hosting: integer("hosting", { mode: "boolean" }),
    enrichmentStatus: text("enrichment_status").notNull().default("unavailable"),
    enrichmentAttempts: integer("enrichment_attempts").notNull().default(0),
    nextEnrichmentAt: integer("next_enrichment_at").notNull().default(0),
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
    index("events_project_time_id_idx").on(table.projectId, table.timestamp, table.id),
    index("events_project_ip_time_idx").on(table.projectId, table.ipAddress, table.timestamp),
    index("events_enrichment_idx").on(table.enrichmentStatus, table.nextEnrichmentAt),
    uniqueIndex("events_client_id_idx").on(table.projectId, table.clientEventId),
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

// No visitor IPs are retained in rejection diagnostics.
export const ingestionDiagnostics = sqliteTable("ingestion_diagnostics", {
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  reason: text("reason").notNull(),
  count: integer("count").notNull().default(1),
  lastAt: integer("last_at").notNull(),
}, table => [uniqueIndex("diagnostics_project_day_reason_idx").on(table.projectId, table.day, table.reason)]);

export const enrichmentCache = sqliteTable("enrichment_cache", {
  ipAddress: text("ip_address").primaryKey(),
  payload: text("payload").notNull(),
  expiresAt: integer("expires_at").notNull(),
});
