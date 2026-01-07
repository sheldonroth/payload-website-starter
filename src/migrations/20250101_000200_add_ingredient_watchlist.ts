/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add ingredient watchlist and weekly digest fields to users
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding ingredient watchlist and weekly digest fields to users...')

    // Add ingredient_watchlist column (JSON array)
    await db.execute(sql`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ingredient_watchlist" jsonb DEFAULT '[]'::jsonb;
    `)

    // Add weekly_digest_enabled column
    await db.execute(sql`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "weekly_digest_enabled" boolean DEFAULT true;
    `)

    console.log('[Migration] User fields added successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "ingredient_watchlist";`)
    await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "weekly_digest_enabled";`)
}
