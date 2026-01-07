/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix Content Collection Columns
 *
 * Renames relationship columns to use the _id suffix that Payload expects.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Fixing content collection column names...')

    // ============================================
    // FIX DAILY_DISCOVERIES COLUMNS
    // ============================================

    // Rename product -> product_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "daily_discoveries" RENAME COLUMN "product" TO "product_id";
        EXCEPTION
            WHEN undefined_column THEN
                -- Column already renamed or doesn't exist
                NULL;
        END $$;
    `)
    console.log('[Migration] Renamed daily_discoveries.product to product_id')

    // Rename alternative_product -> alternative_product_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "daily_discoveries" RENAME COLUMN "alternative_product" TO "alternative_product_id";
        EXCEPTION
            WHEN undefined_column THEN
                NULL;
        END $$;
    `)
    console.log('[Migration] Renamed daily_discoveries.alternative_product to alternative_product_id')

    // ============================================
    // FIX GENERATED_CONTENT COLUMNS
    // ============================================

    // Rename category -> category_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content" RENAME COLUMN "category" TO "category_id";
        EXCEPTION
            WHEN undefined_column THEN
                NULL;
        END $$;
    `)
    console.log('[Migration] Renamed generated_content.category to category_id')

    // Also fix the listicle_items table - product should be product_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_listicle_items" RENAME COLUMN "product" TO "product_id";
        EXCEPTION
            WHEN undefined_column THEN
                NULL;
        END $$;
    `)
    console.log('[Migration] Renamed generated_content_listicle_items.product to product_id')

    console.log('[Migration] Content collection columns fix completed!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back content collection column renames...')

    // Revert daily_discoveries
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "daily_discoveries" RENAME COLUMN "product_id" TO "product";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "daily_discoveries" RENAME COLUMN "alternative_product_id" TO "alternative_product";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    // Revert generated_content
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content" RENAME COLUMN "category_id" TO "category";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_listicle_items" RENAME COLUMN "product_id" TO "product";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    console.log('[Migration] Content collection column rollback completed')
}
