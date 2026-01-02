CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`ip_address` text NOT NULL,
	`type` text NOT NULL,
	`country` text,
	`region` text,
	`city` text,
	`zip` text,
	`isp` text,
	`as_name` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_project_id_idx` ON `events` (`project_id`);--> statement-breakpoint
CREATE INDEX `events_timestamp_idx` ON `events` (`timestamp`);--> statement-breakpoint
CREATE TABLE `project_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`hostname` text NOT NULL,
	`wildcard` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_domains_project_id_idx` ON `project_domains` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_domains_hostname_idx` ON `project_domains` (`hostname`);