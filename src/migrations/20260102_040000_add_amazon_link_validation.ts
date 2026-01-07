/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Amazon link validation fields to products table
 * Tracks whether product Amazon links have been validated
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "amazon_link_status" varchar DEFAULT 'unchecked',
        ADD COLUMN IF NOT EXISTS "amazon_link_last_checked" timestamp with time zone,
        ADD COLUMN IF NOT EXISTS "amazon_link_error" varchar;
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "amazon_link_status",
        DROP COLUMN IF EXISTS "amazon_link_last_checked",
        DROP COLUMN IF EXISTS "amazon_link_error";
    `)
}
