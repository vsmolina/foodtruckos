CREATE TABLE "instagram_account" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"access_token" text NOT NULL,
	"ig_user_id" text NOT NULL,
	"username" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"token_refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"permalink" text NOT NULL,
	"media_type" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
