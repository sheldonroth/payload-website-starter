/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add trending_news_id to payload_locked_documents_rels
 * Required for the TrendingNews collection to work properly
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trending_news_id" integer;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "trending_news_id"
    `)
}
