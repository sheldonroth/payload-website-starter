/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Search Queries Collection
 *
 * Creates table for tracking search queries for analytics.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating search_queries table...')

    // Create source enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_search_queries_source" AS ENUM(
                'web',
                'mobile',
                'api'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create search_queries table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "search_queries" (
            "id" serial PRIMARY KEY NOT NULL,
            "query" varchar NOT NULL,
            "results_count" numeric DEFAULT 0,
            "source" "enum_search_queries_source" DEFAULT 'web',
            "user_id" varchar,
            "device_fingerprint" varchar,
            "session_id" varchar,
            "clicked_result" boolean DEFAULT false,
            "clicked_product_id" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created search_queries table')

    // Add indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "search_queries_query_idx"
        ON "search_queries" USING btree ("query");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "search_queries_created_at_idx"
        ON "search_queries" USING btree ("created_at");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "search_queries_source_idx"
        ON "search_queries" USING btree ("source");
    `)
    console.log('[Migration] Created search_queries indexes')

    // Add to locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "search_queries_id" integer;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_search_queries_fk"
            FOREIGN KEY ("search_queries_id") REFERENCES "search_queries"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Search queries migration completed!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back search_queries...')

    await db.execute(sql`DROP TABLE IF EXISTS "search_queries" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_search_queries_source";`)

    console.log('[Migration] Search queries rollback completed')
}
