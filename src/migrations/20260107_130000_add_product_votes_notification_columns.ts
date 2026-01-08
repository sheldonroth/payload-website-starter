/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Missing Notification Columns to ProductVotes
 *
 * Fixes: column "last_trending_notification" does not exist
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding missing notification columns to product_votes...')

    // Add notification tracking columns
    await db.execute(sql`
        ALTER TABLE "product_votes"
        ADD COLUMN IF NOT EXISTS "last_trending_notification" timestamp(3) with time zone,
        ADD COLUMN IF NOT EXISTS "previous_queue_position" numeric;
    `)
    console.log('[Migration] Added last_trending_notification and previous_queue_position columns')

    console.log('[Migration] Migration completed successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back notification columns migration...')

    await db.execute(sql`
        ALTER TABLE "product_votes"
        DROP COLUMN IF EXISTS "last_trending_notification",
        DROP COLUMN IF EXISTS "previous_queue_position";
    `)

    console.log('[Migration] Rollback completed')
}
