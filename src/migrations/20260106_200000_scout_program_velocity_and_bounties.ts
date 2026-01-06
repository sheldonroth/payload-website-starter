import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Scout Program Migration
 *
 * Adds velocity tracking fields to product_votes for prioritization
 * and creates bounty_categories for category boosts.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Scout Program: Adding velocity tracking and bounty categories...')

    // ============================================
    // ADD VELOCITY TRACKING TO PRODUCT_VOTES
    // ============================================

    // Add photo_contributors and total_contributors columns first (if missing)
    await db.execute(sql`
        ALTER TABLE "product_votes"
        ADD COLUMN IF NOT EXISTS "photo_contributors" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "total_contributors" numeric DEFAULT 0;
    `)
    console.log('[Migration] Added photo_contributors and total_contributors columns')

    // Add velocity tracking columns
    await db.execute(sql`
        ALTER TABLE "product_votes"
        ADD COLUMN IF NOT EXISTS "scan_timestamps" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "scans_last24h" numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "scans_last7d" numeric DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "velocity_score" numeric DEFAULT 0;
    `)
    console.log('[Migration] Added velocity tracking columns')

    // Add urgency_flag enum and column
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_product_votes_urgency_flag" AS ENUM(
                'normal',
                'trending',
                'urgent'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        ALTER TABLE "product_votes"
        ADD COLUMN IF NOT EXISTS "urgency_flag" "enum_product_votes_urgency_flag" DEFAULT 'normal';
    `)
    console.log('[Migration] Added urgency_flag column')

    // Add index on velocity_score for sorting
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "product_votes_velocity_score_idx"
        ON "product_votes" USING btree ("velocity_score");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "product_votes_urgency_flag_idx"
        ON "product_votes" USING btree ("urgency_flag");
    `)
    console.log('[Migration] Created velocity indexes')

    // ============================================
    // CREATE BOUNTY_CATEGORIES TABLE
    // ============================================
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "bounty_categories" (
            "id" serial PRIMARY KEY NOT NULL,
            "category" varchar NOT NULL,
            "headline" varchar,
            "description" varchar,
            "multiplier" numeric DEFAULT 2 NOT NULL,
            "icon" varchar,
            "is_active" boolean DEFAULT true,
            "starts_at" timestamp(3) with time zone,
            "ends_at" timestamp(3) with time zone,
            "total_scans_this_week" numeric DEFAULT 0,
            "total_contributors" numeric DEFAULT 0,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created bounty_categories table')

    // Create bounty_categories_keywords table for the keywords array
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "bounty_categories_keywords" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "keyword" varchar NOT NULL
        );
    `)

    // Add foreign key
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "bounty_categories_keywords"
            ADD CONSTRAINT "bounty_categories_keywords_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "bounty_categories"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log('[Migration] Created bounty_categories_keywords table')

    // Add indexes for bounty_categories
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "bounty_categories_is_active_idx"
        ON "bounty_categories" USING btree ("is_active");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "bounty_categories_keywords_order_parent_idx"
        ON "bounty_categories_keywords" USING btree ("_order", "_parent_id");
    `)
    console.log('[Migration] Created bounty indexes')

    console.log('[Migration] Scout Program migration completed successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back Scout Program migration...')

    // Drop bounty_categories tables
    await db.execute(sql`DROP TABLE IF EXISTS "bounty_categories_keywords" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "bounty_categories" CASCADE;`)

    // Remove velocity columns from product_votes
    await db.execute(sql`
        ALTER TABLE "product_votes"
        DROP COLUMN IF EXISTS "scan_timestamps",
        DROP COLUMN IF EXISTS "scans_last24h",
        DROP COLUMN IF EXISTS "scans_last7d",
        DROP COLUMN IF EXISTS "velocity_score",
        DROP COLUMN IF EXISTS "urgency_flag",
        DROP COLUMN IF EXISTS "photo_contributors",
        DROP COLUMN IF EXISTS "total_contributors";
    `)

    // Drop velocity indexes
    await db.execute(sql`DROP INDEX IF EXISTS "product_votes_velocity_score_idx";`)
    await db.execute(sql`DROP INDEX IF EXISTS "product_votes_urgency_flag_idx";`)

    // Drop enum
    await db.execute(sql`DROP TYPE IF EXISTS "enum_product_votes_urgency_flag";`)

    console.log('[Migration] Scout Program rollback completed')
}
