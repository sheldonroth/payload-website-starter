/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration: Add featured product fields to categories
 *
 * Adds fields to store the auto-calculated featured product for each category:
 * - featuredProduct: Relationship to products collection
 * - featuredProductImage: Cached image URL for quick access
 * - featuredProductUpdatedAt: When the featured product was last calculated
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add featured product columns to categories table
    await db.execute(sql`
        ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "featured_product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS "featured_product_image" varchar,
        ADD COLUMN IF NOT EXISTS "featured_product_updated_at" timestamptz;
    `)

    // Create index for the foreign key
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "categories_featured_product_idx" ON "categories" ("featured_product_id");
    `)

    console.log('Added featured product columns to categories table')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Drop index first
    await db.execute(sql`
        DROP INDEX IF EXISTS "categories_featured_product_idx";
    `)

    // Remove featured product columns
    await db.execute(sql`
        ALTER TABLE "categories"
        DROP COLUMN IF EXISTS "featured_product_id",
        DROP COLUMN IF EXISTS "featured_product_image",
        DROP COLUMN IF EXISTS "featured_product_updated_at";
    `)

    console.log('Removed featured product columns from categories table')
}
