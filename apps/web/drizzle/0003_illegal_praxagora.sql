CREATE TYPE "public"."square_sync_status" AS ENUM('local', 'pending', 'synced', 'error');--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN "square_version" bigint;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN "sync_status" "square_sync_status" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "menu_categories" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "menu_item_variations" ADD COLUMN "square_version" bigint;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "square_version" bigint;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "sync_status" "square_sync_status" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "menu_modifiers" ADD COLUMN "square_version" bigint;--> statement-breakpoint
ALTER TABLE "menu_modifiers" ADD COLUMN "square_modifier_list_version" bigint;--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN "catalog_pulled_at" timestamp with time zone;