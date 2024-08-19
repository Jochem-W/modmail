CREATE TABLE IF NOT EXISTS "block" (
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ping" (
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "thread" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"open" boolean,
	"last" text NOT NULL,
	"last_close" text,
	CONSTRAINT "thread_user_open_unique" UNIQUE("user","open")
);
