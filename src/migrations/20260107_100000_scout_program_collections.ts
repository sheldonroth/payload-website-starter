import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    // ═══════════════════════════════════════════════════════════════════════
    // SCOUT PROFILES TABLE
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "scout_profiles" (
            "id" serial PRIMARY KEY NOT NULL,
            "display_name" varchar DEFAULT 'Anonymous Scout' NOT NULL,
            "fingerprint_hash" varchar,
            "user_id" integer,
            "avatar" varchar DEFAULT '🔍',
            "bio" varchar,
            "scout_number" integer,
            "documents_submitted" integer DEFAULT 0,
            "products_tested_from_submissions" integer DEFAULT 0,
            "people_helped" integer DEFAULT 0,
            "first_discoveries" integer DEFAULT 0,
            "scout_level" varchar DEFAULT 'new',
            "is_public" boolean DEFAULT true,
            "shareable_slug" varchar,
            "badges" jsonb DEFAULT '[]'::jsonb,
            "featured_discoveries" jsonb DEFAULT '[]'::jsonb,
            "notify_on_results" boolean DEFAULT true,
            "notify_on_milestones" boolean DEFAULT true,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "scout_profiles_fingerprint_hash_idx" ON "scout_profiles" USING btree ("fingerprint_hash");
        CREATE UNIQUE INDEX IF NOT EXISTS "scout_profiles_scout_number_idx" ON "scout_profiles" USING btree ("scout_number");
        CREATE UNIQUE INDEX IF NOT EXISTS "scout_profiles_shareable_slug_idx" ON "scout_profiles" USING btree ("shareable_slug");
        CREATE INDEX IF NOT EXISTS "scout_profiles_user_id_idx" ON "scout_profiles" USING btree ("user_id");
        CREATE INDEX IF NOT EXISTS "scout_profiles_created_at_idx" ON "scout_profiles" USING btree ("created_at");
        CREATE INDEX IF NOT EXISTS "scout_profiles_updated_at_idx" ON "scout_profiles" USING btree ("updated_at");
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // MARKET INTELLIGENCE TABLE
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "market_intelligence" (
            "id" serial PRIMARY KEY NOT NULL,
            "source" varchar NOT NULL,
            "external_id" varchar,
            "source_url" varchar,
            "product_name" varchar NOT NULL,
            "brand" varchar,
            "category" varchar,
            "image_url" varchar,
            "price" numeric,
            "upc" varchar,
            "trend_score" integer DEFAULT 0,
            "velocity" integer DEFAULT 0,
            "rank_on_source" integer,
            "review_count" integer,
            "rating" numeric,
            "social_mentions" integer,
            "search_volume" integer,
            "status" varchar DEFAULT 'new' NOT NULL,
            "ignore_reason" varchar,
            "matched_barcode" varchar,
            "linked_product_vote_id" integer,
            "linked_product_id" integer,
            "detected_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "last_seen_at" timestamp(3) with time zone,
            "processed_at" timestamp(3) with time zone,
            "processed_by_id" integer,
            "raw_data" jsonb,
            "notes" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );

        CREATE INDEX IF NOT EXISTS "market_intelligence_source_idx" ON "market_intelligence" USING btree ("source");
        CREATE INDEX IF NOT EXISTS "market_intelligence_external_id_idx" ON "market_intelligence" USING btree ("external_id");
        CREATE INDEX IF NOT EXISTS "market_intelligence_upc_idx" ON "market_intelligence" USING btree ("upc");
        CREATE INDEX IF NOT EXISTS "market_intelligence_trend_score_idx" ON "market_intelligence" USING btree ("trend_score");
        CREATE INDEX IF NOT EXISTS "market_intelligence_status_idx" ON "market_intelligence" USING btree ("status");
        CREATE INDEX IF NOT EXISTS "market_intelligence_detected_at_idx" ON "market_intelligence" USING btree ("detected_at");
        CREATE INDEX IF NOT EXISTS "market_intelligence_created_at_idx" ON "market_intelligence" USING btree ("created_at");
        CREATE INDEX IF NOT EXISTS "market_intelligence_updated_at_idx" ON "market_intelligence" USING btree ("updated_at");
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // BRAND ANALYTICS TABLE
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brand_analytics" (
            "id" serial PRIMARY KEY NOT NULL,
            "brand_id" integer NOT NULL,
            "brand_name" varchar,
            "date" timestamp(3) with time zone NOT NULL,
            "scan_count" integer DEFAULT 0,
            "search_count" integer DEFAULT 0,
            "product_view_count" integer DEFAULT 0,
            "unique_users" integer DEFAULT 0,
            "verdict_breakdown_recommend_count" integer DEFAULT 0,
            "verdict_breakdown_caution_count" integer DEFAULT 0,
            "verdict_breakdown_avoid_count" integer DEFAULT 0,
            "verdict_breakdown_avoid_hit_count" integer DEFAULT 0,
            "trust_score" integer,
            "trust_grade" varchar,
            "category_rank" integer,
            "overall_rank" integer,
            "changes_scan_count_change" numeric,
            "changes_trust_score_change" numeric,
            "changes_category_rank_change" integer,
            "changes_week_over_week_growth" numeric,
            "product_count" integer DEFAULT 0,
            "tested_product_count" integer DEFAULT 0,
            "pending_test_count" integer DEFAULT 0,
            "average_product_score" numeric,
            "top_scanned_products" jsonb DEFAULT '[]'::jsonb,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );

        CREATE INDEX IF NOT EXISTS "brand_analytics_brand_id_idx" ON "brand_analytics" USING btree ("brand_id");
        CREATE INDEX IF NOT EXISTS "brand_analytics_date_idx" ON "brand_analytics" USING btree ("date");
        CREATE UNIQUE INDEX IF NOT EXISTS "brand_analytics_brand_date_idx" ON "brand_analytics" USING btree ("brand_id", "date");
        CREATE INDEX IF NOT EXISTS "brand_analytics_created_at_idx" ON "brand_analytics" USING btree ("created_at");
        CREATE INDEX IF NOT EXISTS "brand_analytics_updated_at_idx" ON "brand_analytics" USING btree ("updated_at");
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // BRAND USERS TABLE (Auth-enabled)
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brand_users" (
            "id" serial PRIMARY KEY NOT NULL,
            "email" varchar NOT NULL,
            "name" varchar NOT NULL,
            "job_title" varchar,
            "phone" varchar,
            "brand_id" integer NOT NULL,
            "role" varchar DEFAULT 'analyst' NOT NULL,
            "is_verified" boolean DEFAULT false,
            "verified_at" timestamp(3) with time zone,
            "verified_by_id" integer,
            "verification_method" varchar,
            "verification_notes" varchar,
            "subscription" varchar DEFAULT 'free' NOT NULL,
            "subscription_start_date" timestamp(3) with time zone,
            "subscription_end_date" timestamp(3) with time zone,
            "stripe_customer_id" varchar,
            "stripe_subscription_id" varchar,
            "features_can_view_competitors" boolean DEFAULT false,
            "features_can_export_data" boolean DEFAULT false,
            "features_can_access_api" boolean DEFAULT false,
            "features_can_view_demand_signals" boolean DEFAULT false,
            "features_can_manage_team" boolean DEFAULT false,
            "last_login_at" timestamp(3) with time zone,
            "login_count" integer DEFAULT 0,
            "notifications_weekly_digest" boolean DEFAULT true,
            "notifications_trust_score_alerts" boolean DEFAULT true,
            "notifications_new_product_alerts" boolean DEFAULT false,
            "notifications_competitor_alerts" boolean DEFAULT false,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "hash" varchar,
            "salt" varchar,
            "reset_password_token" varchar,
            "reset_password_expiration" timestamp(3) with time zone,
            "lock_until" timestamp(3) with time zone,
            "login_attempts" integer DEFAULT 0
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "brand_users_email_idx" ON "brand_users" USING btree ("email");
        CREATE INDEX IF NOT EXISTS "brand_users_brand_id_idx" ON "brand_users" USING btree ("brand_id");
        CREATE INDEX IF NOT EXISTS "brand_users_created_at_idx" ON "brand_users" USING btree ("created_at");
        CREATE INDEX IF NOT EXISTS "brand_users_updated_at_idx" ON "brand_users" USING btree ("updated_at");
    `)

    // Brand users additional brands relationship table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brand_users_rels" (
            "id" serial PRIMARY KEY NOT NULL,
            "order" integer,
            "parent_id" integer NOT NULL,
            "path" varchar NOT NULL,
            "brands_id" integer
        );

        CREATE INDEX IF NOT EXISTS "brand_users_rels_parent_idx" ON "brand_users_rels" USING btree ("parent_id");
        CREATE INDEX IF NOT EXISTS "brand_users_rels_path_idx" ON "brand_users_rels" USING btree ("path");
        CREATE INDEX IF NOT EXISTS "brand_users_rels_brands_id_idx" ON "brand_users_rels" USING btree ("brands_id");
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // ADD SCOUT ATTRIBUTION TO PRODUCT_VOTES
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "product_votes"
        ADD COLUMN IF NOT EXISTS "first_scout_id" integer,
        ADD COLUMN IF NOT EXISTS "first_scout_number" integer,
        ADD COLUMN IF NOT EXISTS "scout_contributors" jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "total_scouts" integer DEFAULT 0;

        CREATE INDEX IF NOT EXISTS "product_votes_first_scout_id_idx" ON "product_votes" USING btree ("first_scout_id");
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // ADD SCOUT ATTRIBUTION TO PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "scout_attribution_first_scout_id" integer,
        ADD COLUMN IF NOT EXISTS "scout_attribution_total_scouts" integer DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "scout_attribution_scout_contributors" jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "scout_attribution_linked_product_vote_id" integer,
        ADD COLUMN IF NOT EXISTS "scout_attribution_scans_after_testing" integer DEFAULT 0;

        CREATE INDEX IF NOT EXISTS "products_scout_attribution_first_scout_id_idx" ON "products" USING btree ("scout_attribution_first_scout_id");
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // FOREIGN KEY CONSTRAINTS
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_user_id_users_id_fk"
                FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "market_intelligence" ADD CONSTRAINT "market_intelligence_linked_product_vote_id_product_votes_id_fk"
                FOREIGN KEY ("linked_product_vote_id") REFERENCES "public"."product_votes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "market_intelligence" ADD CONSTRAINT "market_intelligence_linked_product_id_products_id_fk"
                FOREIGN KEY ("linked_product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "market_intelligence" ADD CONSTRAINT "market_intelligence_processed_by_id_users_id_fk"
                FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "brand_analytics" ADD CONSTRAINT "brand_analytics_brand_id_brands_id_fk"
                FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "brand_users" ADD CONSTRAINT "brand_users_brand_id_brands_id_fk"
                FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "brand_users" ADD CONSTRAINT "brand_users_verified_by_id_users_id_fk"
                FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "brand_users_rels" ADD CONSTRAINT "brand_users_rels_parent_fk"
                FOREIGN KEY ("parent_id") REFERENCES "public"."brand_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "brand_users_rels" ADD CONSTRAINT "brand_users_rels_brands_id_fk"
                FOREIGN KEY ("brands_id") REFERENCES "public"."brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "product_votes" ADD CONSTRAINT "product_votes_first_scout_id_scout_profiles_id_fk"
                FOREIGN KEY ("first_scout_id") REFERENCES "public"."scout_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "products" ADD CONSTRAINT "products_scout_attribution_first_scout_id_scout_profiles_id_fk"
                FOREIGN KEY ("scout_attribution_first_scout_id") REFERENCES "public"."scout_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;

        DO $$ BEGIN
            ALTER TABLE "products" ADD CONSTRAINT "products_scout_attribution_linked_product_vote_id_product_votes_id_fk"
                FOREIGN KEY ("scout_attribution_linked_product_vote_id") REFERENCES "public"."product_votes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION WHEN duplicate_object THEN null; END $$;
    `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    // Remove foreign key constraints first
    await db.execute(sql`
        ALTER TABLE IF EXISTS "scout_profiles" DROP CONSTRAINT IF EXISTS "scout_profiles_user_id_users_id_fk";
        ALTER TABLE IF EXISTS "market_intelligence" DROP CONSTRAINT IF EXISTS "market_intelligence_linked_product_vote_id_product_votes_id_fk";
        ALTER TABLE IF EXISTS "market_intelligence" DROP CONSTRAINT IF EXISTS "market_intelligence_linked_product_id_products_id_fk";
        ALTER TABLE IF EXISTS "market_intelligence" DROP CONSTRAINT IF EXISTS "market_intelligence_processed_by_id_users_id_fk";
        ALTER TABLE IF EXISTS "brand_analytics" DROP CONSTRAINT IF EXISTS "brand_analytics_brand_id_brands_id_fk";
        ALTER TABLE IF EXISTS "brand_users" DROP CONSTRAINT IF EXISTS "brand_users_brand_id_brands_id_fk";
        ALTER TABLE IF EXISTS "brand_users" DROP CONSTRAINT IF EXISTS "brand_users_verified_by_id_users_id_fk";
        ALTER TABLE IF EXISTS "brand_users_rels" DROP CONSTRAINT IF EXISTS "brand_users_rels_parent_fk";
        ALTER TABLE IF EXISTS "brand_users_rels" DROP CONSTRAINT IF EXISTS "brand_users_rels_brands_id_fk";
        ALTER TABLE IF EXISTS "product_votes" DROP CONSTRAINT IF EXISTS "product_votes_first_scout_id_scout_profiles_id_fk";
        ALTER TABLE IF EXISTS "products" DROP CONSTRAINT IF EXISTS "products_scout_attribution_first_scout_id_scout_profiles_id_fk";
        ALTER TABLE IF EXISTS "products" DROP CONSTRAINT IF EXISTS "products_scout_attribution_linked_product_vote_id_product_votes_id_fk";
    `)

    // Remove scout attribution columns from products
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "scout_attribution_first_scout_id",
        DROP COLUMN IF EXISTS "scout_attribution_total_scouts",
        DROP COLUMN IF EXISTS "scout_attribution_scout_contributors",
        DROP COLUMN IF EXISTS "scout_attribution_linked_product_vote_id",
        DROP COLUMN IF EXISTS "scout_attribution_scans_after_testing";
    `)

    // Remove scout attribution columns from product_votes
    await db.execute(sql`
        ALTER TABLE "product_votes"
        DROP COLUMN IF EXISTS "first_scout_id",
        DROP COLUMN IF EXISTS "first_scout_number",
        DROP COLUMN IF EXISTS "scout_contributors",
        DROP COLUMN IF EXISTS "total_scouts";
    `)

    // Drop tables
    await db.execute(sql`
        DROP TABLE IF EXISTS "brand_users_rels";
        DROP TABLE IF EXISTS "brand_users";
        DROP TABLE IF EXISTS "brand_analytics";
        DROP TABLE IF EXISTS "market_intelligence";
        DROP TABLE IF EXISTS "scout_profiles";
    `)
}
