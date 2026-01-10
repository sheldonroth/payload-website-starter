/**
 * Database Migration: Audit Fixes
 *
 * This migration adds performance indexes identified during the security audit:
 * 1. Index on products.brand - frequently filtered/searched field
 * 2. Index on products.freshness_status - used in admin list filtering
 *
 * NOTE: These indexes may already exist if Payload auto-created them from the
 * collection definition. The DO block handles this gracefully.
 *
 * Part of the comprehensive backend audit fixes.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding Audit Fix Indexes...')

    // Use DO blocks to handle race conditions and existing indexes gracefully
    // This prevents errors when multiple build processes run simultaneously

    // ═══════════════════════════════════════════════════════════════════════
    // 1. ADD INDEX ON PRODUCTS.BRAND (Frequently filtered/searched)
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'products_brand_idx') THEN
                CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");
            END IF;
        EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN duplicate_object THEN NULL;
        END $$;
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // 2. ADD INDEX ON PRODUCTS.FRESHNESS_STATUS (Admin list filtering)
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'products_freshness_status_idx') THEN
                CREATE INDEX "products_freshness_status_idx" ON "products" USING btree ("freshness_status");
            END IF;
        EXCEPTION
            WHEN duplicate_table THEN NULL;
            WHEN duplicate_object THEN NULL;
        END $$;
    `)

    console.log('[Migration] Audit Fix Indexes added!')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Remove indexes
    await db.execute(sql`DROP INDEX IF EXISTS "products_brand_idx";`)
    await db.execute(sql`DROP INDEX IF EXISTS "products_freshness_status_idx";`)
}
