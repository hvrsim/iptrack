CREATE TABLE `enrichment_cache` (
	`ip_address` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_diagnostics` (
	`project_id` text NOT NULL,
	`day` integer NOT NULL,
	`reason` text NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`last_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diagnostics_project_day_reason_idx` ON `ingestion_diagnostics` (`project_id`,`day`,`reason`);--> statement-breakpoint
ALTER TABLE `events` ADD `client_event_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `client_timestamp` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `proxy` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `mobile` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `hosting` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `enrichment_status` text DEFAULT 'unavailable' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `enrichment_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `next_enrichment_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `events_project_time_id_idx` ON `events` (`project_id`,`timestamp`,`id`);--> statement-breakpoint
CREATE INDEX `events_project_ip_time_idx` ON `events` (`project_id`,`ip_address`,`timestamp`);--> statement-breakpoint
CREATE INDEX `events_enrichment_idx` ON `events` (`enrichment_status`,`next_enrichment_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_client_id_idx` ON `events` (`project_id`,`client_event_id`);--> statement-breakpoint
ALTER TABLE `projects` ADD `retention_days` integer DEFAULT 30 NOT NULL;
--> statement-breakpoint
-- Legacy hosting rows include residential traffic and lookup failures. The
-- original flags cannot be recovered; preserve only positively known signals.
UPDATE events SET proxy = CASE WHEN type = 'proxy' THEN 1 ELSE NULL END,
  mobile = CASE WHEN type = 'mobile' THEN 1 ELSE NULL END,
  type = CASE WHEN type IN ('proxy', 'mobile') THEN type ELSE 'unknown' END,
  enrichment_status = 'legacy';
