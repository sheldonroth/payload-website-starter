/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add amazon_asin column to products table for affiliate link generation
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding amazon_asin column to products...')

    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "amazon_asin" varchar;
    `)

    // Add index for faster lookups
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "products_amazon_asin_idx" ON "products" USING btree ("amazon_asin");
    `)

    console.log('[Migration] amazon_asin column added successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DROP INDEX IF EXISTS "products_amazon_asin_idx";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "amazon_asin";`)
}
