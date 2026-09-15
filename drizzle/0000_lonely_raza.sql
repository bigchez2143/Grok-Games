CREATE TABLE `blackjack_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`player_hash` text NOT NULL,
	`dealer_hash` text NOT NULL,
	`state` text NOT NULL,
	`revision` integer NOT NULL,
	`bot_seen` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blackjack_tables_player_hash_unique` ON `blackjack_tables` (`player_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `blackjack_tables_dealer_hash_unique` ON `blackjack_tables` (`dealer_hash`);