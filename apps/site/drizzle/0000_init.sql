CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'quoted', 'booked', 'declined');--> statement-breakpoint
CREATE TYPE "public"."merch_order_status" AS ENUM('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."partner_kind" AS ENUM('bar', 'bartender', 'other');--> statement-breakpoint
CREATE TYPE "public"."photo_source" AS ENUM('owner', 'submission');--> statement-breakpoint
CREATE TYPE "public"."photo_status" AS ENUM('pending', 'approved', 'rejected', 'removed');--> statement-breakpoint
CREATE TYPE "public"."truck_status" AS ENUM('open', 'closed', 'back_soon');--> statement-breakpoint
CREATE TYPE "public"."web_order_status" AS ENUM('pending_payment', 'received', 'preparing', 'ready', 'picked_up', 'cancelled', 'failed');--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"special_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"send_email" boolean DEFAULT true NOT NULL,
	"send_sms" boolean DEFAULT false NOT NULL,
	"email_count" integer DEFAULT 0 NOT NULL,
	"sms_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catering_leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"event_date" date NOT NULL,
	"start_time" text NOT NULL,
	"duration_hours" text NOT NULL,
	"location" text NOT NULL,
	"guest_count" integer NOT NULL,
	"event_type" text NOT NULL,
	"service_style" text NOT NULL,
	"menu_interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"budget_range" text,
	"notes" text,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gallery_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text,
	"source" "photo_source" NOT NULL,
	"status" "photo_status" DEFAULT 'pending' NOT NULL,
	"submitter_name" text,
	"submitter_email" text,
	"submitter_instagram" text,
	"consent_confirmed" boolean DEFAULT false NOT NULL,
	"consent_text" text,
	"consent_at" timestamp with time zone,
	"consent_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"square_id" text,
	"name" text NOT NULL,
	"label_es" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_categories_square_id_unique" UNIQUE("square_id")
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid,
	"square_id" text,
	"name" text NOT NULL,
	"description" text,
	"tagline_es" text,
	"photo_url" text,
	"photo_override_url" text,
	"sold_out" boolean DEFAULT false NOT NULL,
	"square_sold_out" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_square_id_unique" UNIQUE("square_id")
);
--> statement-breakpoint
CREATE TABLE "menu_modifiers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"square_id" text,
	"group_name" text DEFAULT 'Options' NOT NULL,
	"group_max" integer,
	"group_required" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_variations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"item_id" uuid NOT NULL,
	"square_id" text,
	"name" text DEFAULT 'Regular' NOT NULL,
	"price_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "menu_variations_square_id_unique" UNIQUE("square_id")
);
--> statement-breakpoint
CREATE TABLE "merch_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "merch_order_status" DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"email" text,
	"name" text,
	"delivery" text DEFAULT 'ship' NOT NULL,
	"shipping_address" jsonb,
	"lines" jsonb NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"tracking_number" text,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merch_orders_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "merch_products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"photo_url" text,
	"price_cents" integer NOT NULL,
	"fulfillment" text DEFAULT 'self' NOT NULL,
	"provider_ref" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merch_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "merch_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"size" text,
	"color" text,
	"price_cents" integer,
	"stock" integer,
	"sku" text,
	"provider_ref" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"referrer_host" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_visits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "partner_kind" DEFAULT 'bar' NOT NULL,
	"blurb" text,
	"photo_url" text,
	"instagram" text,
	"url" text,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"status" "truck_status" DEFAULT 'closed' NOT NULL,
	"status_message" text,
	"ordering_paused" boolean DEFAULT false NOT NULL,
	"paused_message" text,
	"default_wait_minutes" integer DEFAULT 10 NOT NULL,
	"location_name" text DEFAULT 'The Square, behind Harper’s' NOT NULL,
	"address" text DEFAULT 'San Marcos, TX 78666' NOT NULL,
	"lat" text DEFAULT '29.8830' NOT NULL,
	"lng" text DEFAULT '-97.9411' NOT NULL,
	"late_night_note" text,
	"phone" text,
	"instagram" text DEFAULT 'barrioburgerco' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specials" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kicker" text,
	"body" text,
	"price_label" text,
	"photo_url" text,
	"menu_item_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text,
	"email_opt_in" boolean DEFAULT false NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"consent_text" text NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"email_unsubscribed_at" timestamp with time zone,
	"sms_stopped_at" timestamp with time zone,
	"unsubscribe_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscribers_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "takedown_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"photo_id" uuid,
	"description" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"reason" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "web_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"token" text NOT NULL,
	"status" "web_order_status" DEFAULT 'pending_payment' NOT NULL,
	"square_order_id" text,
	"square_payment_id" text,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"sms_opt_in" boolean DEFAULT false NOT NULL,
	"sms_consent_text" text,
	"ready_sms_sent_at" timestamp with time zone,
	"lines" jsonb NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"partner_id" uuid,
	"estimated_ready_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "web_orders_code_unique" UNIQUE("code"),
	CONSTRAINT "web_orders_token_unique" UNIQUE("token"),
	CONSTRAINT "web_orders_square_order_id_unique" UNIQUE("square_order_id")
);
--> statement-breakpoint
CREATE TABLE "weekly_hours" (
	"day_of_week" smallint PRIMARY KEY NOT NULL,
	"opens" text,
	"closes" text,
	"closed" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_special_id_specials_id_fk" FOREIGN KEY ("special_id") REFERENCES "public"."specials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_modifiers" ADD CONSTRAINT "menu_modifiers_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_variations" ADD CONSTRAINT "menu_variations_item_id_menu_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_variants" ADD CONSTRAINT "merch_variants_product_id_merch_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."merch_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_visits" ADD CONSTRAINT "partner_visits_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specials" ADD CONSTRAINT "specials_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takedown_requests" ADD CONSTRAINT "takedown_requests_photo_id_gallery_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."gallery_photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_orders" ADD CONSTRAINT "web_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catering_status_idx" ON "catering_leads" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "gallery_status_idx" ON "gallery_photos" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "menu_modifiers_item_idx" ON "menu_modifiers" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "menu_variations_item_idx" ON "menu_variations" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "merch_orders_created_idx" ON "merch_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "merch_variants_product_idx" ON "merch_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "message_log_created_idx" ON "message_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_at_idx" ON "page_views" USING btree ("at");--> statement-breakpoint
CREATE INDEX "partner_visits_partner_idx" ON "partner_visits" USING btree ("partner_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_email_uq" ON "subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscribers_phone_uq" ON "subscribers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "web_orders_created_idx" ON "web_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "web_orders_partner_idx" ON "web_orders" USING btree ("partner_id");