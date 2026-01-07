/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add voting fields to user_submissions for product request queue
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding voting fields to user_submissions...')

    // Add vote_count column
    await db.execute(sql`
        ALTER TABLE "user_submissions" ADD COLUMN IF NOT EXISTS "vote_count" integer DEFAULT 0;
    `)

    // Add voters column (JSON array)
    await db.execute(sql`
        ALTER TABLE "user_submissions" ADD COLUMN IF NOT EXISTS "voters" jsonb DEFAULT '[]'::jsonb;
    `)

    // Add product_request_details columns
    await db.execute(sql`
        ALTER TABLE "user_submissions" ADD COLUMN IF NOT EXISTS "product_request_details_requested_product_name" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "user_submissions" ADD COLUMN IF NOT EXISTS "product_request_details_requested_brand" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "user_submissions" ADD COLUMN IF NOT EXISTS "product_request_details_product_url" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "user_submissions" ADD COLUMN IF NOT EXISTS "product_request_details_reason_for_request" varchar;
    `)

    // Add index for faster sorting by vote count
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_submissions_vote_count_idx" ON "user_submissions" USING btree ("vote_count");
    `)

    console.log('[Migration] Voting fields added successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DROP INDEX IF EXISTS "user_submissions_vote_count_idx";`)
    await db.execute(sql`ALTER TABLE "user_submissions" DROP COLUMN IF EXISTS "vote_count";`)
    await db.execute(sql`ALTER TABLE "user_submissions" DROP COLUMN IF EXISTS "voters";`)
    await db.execute(sql`ALTER TABLE "user_submissions" DROP COLUMN IF EXISTS "product_request_details_requested_product_name";`)
    await db.execute(sql`ALTER TABLE "user_submissions" DROP COLUMN IF EXISTS "product_request_details_requested_brand";`)
    await db.execute(sql`ALTER TABLE "user_submissions" DROP COLUMN IF EXISTS "product_request_details_product_url";`)
    await db.execute(sql`ALTER TABLE "user_submissions" DROP COLUMN IF EXISTS "product_request_details_reason_for_request";`)
}
