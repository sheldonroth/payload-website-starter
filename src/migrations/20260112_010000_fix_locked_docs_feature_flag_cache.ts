/**
 * Database Migration: Create feature_flag_cache table and fix payload_locked_documents_rels
 *
 * This migration:
 * 1. Creates the missing feature_flag_cache table
 * 2. Adds the missing feature_flag_cache_id column to payload_locked_documents_rels
 *
 * Error being fixed:
 * "column payload_locked_documents__rels.feature_flag_cache_id does not exist"
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating feature_flag_cache table...')

    // ═══════════════════════════════════════════════════════════════════════
    // 1. CREATE THE FEATURE_FLAG_CACHE TABLE
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "feature_flag_cache" (
            "id" serial PRIMARY KEY,
            "statsig_id" varchar NOT NULL,
            "type" varchar NOT NULL,
            "name" varchar NOT NULL,
            "description" varchar,
            "is_enabled" boolean DEFAULT false,
            "rollout_percentage" numeric,
            "variants" jsonb,
            "experiment_status" varchar,
            "rules" jsonb,
            "default_value" boolean DEFAULT false,
            "last_synced_at" timestamp(3) with time zone,
            "sync_error" varchar,
            "statsig_last_modified" timestamp(3) with time zone,
            "checks_per_hour" numeric,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Create unique index on statsig_id
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "feature_flag_cache_statsig_id_idx"
        ON "feature_flag_cache" USING btree ("statsig_id");
    `)

    // Create composite index for type + is_enabled
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feature_flag_cache_type_enabled_idx"
        ON "feature_flag_cache" USING btree ("type", "is_enabled");
    `)

    // Create index for last_synced_at
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feature_flag_cache_last_synced_idx"
        ON "feature_flag_cache" USING btree ("last_synced_at");
    `)

    console.log('[Migration] Created feature_flag_cache table')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. CREATE TAGS ARRAY TABLE
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "feature_flag_cache_tags" (
            "id" serial PRIMARY KEY,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "text" varchar
        );
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feature_flag_cache_tags_order_parent_idx"
        ON "feature_flag_cache_tags" USING btree ("_order", "_parent_id");
    `)

    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'feature_flag_cache_tags_parent_fk'
            ) THEN
                ALTER TABLE "feature_flag_cache_tags"
                ADD CONSTRAINT "feature_flag_cache_tags_parent_fk"
                FOREIGN KEY ("_parent_id")
                REFERENCES "feature_flag_cache"("id") ON DELETE CASCADE;
            END IF;
        END $$;
    `)

    console.log('[Migration] Created feature_flag_cache_tags table')

    // ═══════════════════════════════════════════════════════════════════════
    // 3. ADD COLUMN TO PAYLOAD_LOCKED_DOCUMENTS_RELS
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "feature_flag_cache_id" integer;
    `)

    // Add foreign key constraint
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'payload_locked_documents_rels_feature_flag_cache_fk'
            ) THEN
                ALTER TABLE "payload_locked_documents_rels"
                ADD CONSTRAINT "payload_locked_documents_rels_feature_flag_cache_fk"
                FOREIGN KEY ("feature_flag_cache_id")
                REFERENCES "feature_flag_cache"("id") ON DELETE CASCADE;
            END IF;
        END $$;
    `)

    // Add index for performance
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_feature_flag_cache_id_idx"
        ON "payload_locked_documents_rels" USING btree ("feature_flag_cache_id");
    `)

    console.log('[Migration] Added feature_flag_cache_id to payload_locked_documents_rels')
    console.log('[Migration] Feature flag cache setup complete!')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Drop locked documents relationship
    await db.execute(sql`DROP INDEX IF EXISTS "payload_locked_documents_rels_feature_flag_cache_id_idx";`)
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_feature_flag_cache_fk";`)
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "feature_flag_cache_id";`)

    // Drop tags table
    await db.execute(sql`DROP TABLE IF EXISTS "feature_flag_cache_tags";`)

    // Drop main table
    await db.execute(sql`DROP TABLE IF EXISTS "feature_flag_cache";`)
}
