CREATE TABLE IF NOT EXISTS `guild_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
