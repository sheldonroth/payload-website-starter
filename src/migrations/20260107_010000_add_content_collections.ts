import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Content Collections
 *
 * Creates tables for GeneratedContent and DailyDiscoveries collections.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating content collections tables...')

    // ============================================
    // CREATE GENERATED_CONTENT TABLE
    // ============================================

    // Create contentType enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_generated_content_content_type" AS ENUM(
                'listicle',
                'tiktok_script',
                'comparison',
                'controversy',
                'quiz',
                'product_review'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create status enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_generated_content_status" AS ENUM(
                'draft',
                'pending_review',
                'approved',
                'scheduled',
                'published',
                'rejected'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create script_estimated_duration enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_generated_content_script_estimated_duration" AS ENUM(
                '15',
                '30',
                '45',
                '60'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create generated_content table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content" (
            "id" serial PRIMARY KEY NOT NULL,
            "title" varchar NOT NULL,
            "content_type" "enum_generated_content_content_type" NOT NULL,
            "status" "enum_generated_content_status" DEFAULT 'draft' NOT NULL,
            "content" jsonb,
            "script_hook" varchar,
            "script_build" varchar,
            "script_reveal" varchar,
            "script_cta" varchar,
            "script_estimated_duration" "enum_generated_content_script_estimated_duration",
            "comparison_verdict" varchar,
            "category" integer,
            "seo_meta_title" varchar,
            "seo_meta_description" varchar,
            "legal_reviewed" boolean DEFAULT false,
            "legal_notes" varchar,
            "brand_notified" boolean DEFAULT false,
            "brand_response_deadline" timestamp(3) with time zone,
            "scheduled_publish_date" timestamp(3) with time zone,
            "published_url" varchar,
            "generation_metadata_generated_at" timestamp(3) with time zone,
            "generation_metadata_generated_by" varchar,
            "generation_metadata_trigger" varchar,
            "generation_metadata_original_prompt" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created generated_content table')

    // Create array tables for generated_content
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content_listicle_items" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "rank" numeric,
            "product" integer,
            "heading" varchar,
            "description" varchar,
            "verdict" varchar
        );
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content_comparison_key_differences" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "factor" varchar,
            "product_a_value" varchar,
            "product_b_value" varchar
        );
    `)

    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content_seo_target_keywords" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "keyword" varchar
        );
    `)

    // Add foreign keys for arrays
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_listicle_items"
            ADD CONSTRAINT "generated_content_listicle_items_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "generated_content"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_comparison_key_differences"
            ADD CONSTRAINT "generated_content_comparison_key_differences_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "generated_content"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_seo_target_keywords"
            ADD CONSTRAINT "generated_content_seo_target_keywords_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "generated_content"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create rels table for generated_content (relationships)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content_rels" (
            "id" serial PRIMARY KEY NOT NULL,
            "order" integer,
            "parent_id" integer NOT NULL,
            "path" varchar NOT NULL,
            "products_id" integer,
            "categories_id" integer
        );
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_rels"
            ADD CONSTRAINT "generated_content_rels_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "generated_content"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "generated_content_content_type_idx"
        ON "generated_content" USING btree ("content_type");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "generated_content_status_idx"
        ON "generated_content" USING btree ("status");
    `)
    console.log('[Migration] Created generated_content indexes')

    // ============================================
    // CREATE DAILY_DISCOVERIES TABLE
    // ============================================

    // Create discoveryType enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_daily_discoveries_discovery_type" AS ENUM(
                'brand_exposed',
                'hidden_champion',
                'ingredient_spotlight',
                'label_detective',
                'swap'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create status enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_daily_discoveries_status" AS ENUM(
                'draft',
                'scheduled',
                'live',
                'expired'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create daily_discoveries table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "daily_discoveries" (
            "id" serial PRIMARY KEY NOT NULL,
            "title" varchar NOT NULL,
            "discovery_type" "enum_daily_discoveries_discovery_type" NOT NULL DEFAULT 'brand_exposed',
            "product" integer NOT NULL,
            "headline" varchar NOT NULL,
            "insight" varchar NOT NULL,
            "alternative_product" integer,
            "publish_date" timestamp(3) with time zone NOT NULL,
            "expires_at" timestamp(3) with time zone,
            "status" "enum_daily_discoveries_status" DEFAULT 'draft',
            "share_card_background_color" varchar DEFAULT '#D64942',
            "share_card_emoji" varchar DEFAULT '🔍',
            "stats_views" numeric DEFAULT 0,
            "stats_shares" numeric DEFAULT 0,
            "stats_product_detail_clicks" numeric DEFAULT 0,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created daily_discoveries table')

    // Add foreign keys
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "daily_discoveries"
            ADD CONSTRAINT "daily_discoveries_product_fk"
            FOREIGN KEY ("product") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "daily_discoveries"
            ADD CONSTRAINT "daily_discoveries_alternative_product_fk"
            FOREIGN KEY ("alternative_product") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "daily_discoveries_discovery_type_idx"
        ON "daily_discoveries" USING btree ("discovery_type");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "daily_discoveries_status_idx"
        ON "daily_discoveries" USING btree ("status");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "daily_discoveries_publish_date_idx"
        ON "daily_discoveries" USING btree ("publish_date");
    `)
    console.log('[Migration] Created daily_discoveries indexes')

    console.log('[Migration] Content collections migration completed!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back content collections...')

    // Drop daily_discoveries
    await db.execute(sql`DROP TABLE IF EXISTS "daily_discoveries" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_daily_discoveries_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_daily_discoveries_discovery_type";`)

    // Drop generated_content tables
    await db.execute(sql`DROP TABLE IF EXISTS "generated_content_rels" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "generated_content_seo_target_keywords" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "generated_content_comparison_key_differences" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "generated_content_listicle_items" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "generated_content" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_generated_content_script_estimated_duration";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_generated_content_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_generated_content_content_type";`)

    console.log('[Migration] Content collections rollback completed')
}
