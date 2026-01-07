/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add unique constraint to products.slug column
 * Also handles collision prevention for existing duplicates
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding unique constraint to products.slug...')

    // First, find and fix any duplicate slugs
    await db.execute(sql`
        WITH duplicates AS (
            SELECT id, slug,
                   ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) as rn
            FROM products
            WHERE slug IS NOT NULL
        )
        UPDATE products p
        SET slug = p.slug || '-' || d.rn
        FROM duplicates d
        WHERE p.id = d.id AND d.rn > 1;
    `)
    console.log('[Migration] Fixed duplicate slugs')

    // Add unique constraint
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "products" ADD CONSTRAINT "products_slug_unique" UNIQUE ("slug");
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log('[Migration] Added unique constraint to products.slug')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_slug_unique";
    `)
}
