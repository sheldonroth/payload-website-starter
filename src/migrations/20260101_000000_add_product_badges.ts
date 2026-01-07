/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration: Add badges group fields to products
 *
 * Adds badge fields for product awards and recognition:
 * - isBestOverall: #1 pick for category (gold medal)
 * - isBestInCategory: Featured product for category
 * - isRecommended: Staff recommended
 * - isBestValue: Best price-to-quality ratio
 * - isEditorsChoice: Editor's top pick
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add all badge columns to products table
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "badges_is_best_overall" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "badges_is_best_in_category" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "badges_is_recommended" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "badges_is_best_value" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "badges_is_editors_choice" boolean DEFAULT false;
    `)

    console.log('Added badge columns to products table')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Remove badge columns
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "badges_is_best_overall",
        DROP COLUMN IF EXISTS "badges_is_best_in_category",
        DROP COLUMN IF EXISTS "badges_is_recommended",
        DROP COLUMN IF EXISTS "badges_is_best_value",
        DROP COLUMN IF EXISTS "badges_is_editors_choice";
    `)

    console.log('Removed badge columns from products table')
}
