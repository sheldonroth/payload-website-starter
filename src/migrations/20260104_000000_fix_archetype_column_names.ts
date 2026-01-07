/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix Archetype Column Names Migration
 *
 * The previous migration created columns without the badges_ prefix.
 * This migration adds the correctly named columns.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add correctly named columns
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "badges_archetype_calculated_at" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "badges_archetype_override" boolean DEFAULT false;
    `)

    // Drop incorrectly named columns (if they exist)
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "archetype_calculated_at";
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "archetype_override";
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Restore old column names (for rollback)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "archetype_calculated_at" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "archetype_override" boolean DEFAULT false;
    `)

    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "badges_archetype_calculated_at";
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "badges_archetype_override";
    `)
}
