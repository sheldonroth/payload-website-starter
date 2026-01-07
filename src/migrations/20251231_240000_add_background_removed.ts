/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration: Add backgroundRemoved field to products
 *
 * This field tracks whether a product's image has had its background removed.
 * Used to prevent duplicate API charges when auto-processing on publish.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add backgroundRemoved column to products table
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "background_removed" boolean DEFAULT false;
    `)

    console.log('Added background_removed column to products table')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Remove backgroundRemoved column
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "background_removed";
    `)

    console.log('Removed background_removed column from products table')
}
