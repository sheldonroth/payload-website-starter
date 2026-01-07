/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Scout Attribution Columns to Products
 * 
 * These columns support the scoutAttribution group field in Products.ts
 * which tracks contributors who helped get products tested.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding scoutAttribution columns to products...')

    // Add all scoutAttribution group columns
    // Using IF NOT EXISTS pattern for idempotency
    await db.execute(sql`
        DO $$
        BEGIN
            -- First Scout relationship
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'scout_attribution_first_scout'
            ) THEN
                ALTER TABLE products ADD COLUMN scout_attribution_first_scout INTEGER;
            END IF;
            
            -- First Scout Number (for display)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'scout_attribution_first_scout_number'
            ) THEN
                ALTER TABLE products ADD COLUMN scout_attribution_first_scout_number INTEGER;
            END IF;
            
            -- Total Scouts count
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'scout_attribution_total_scouts'
            ) THEN
                ALTER TABLE products ADD COLUMN scout_attribution_total_scouts INTEGER DEFAULT 0;
            END IF;
            
            -- Scout Contributors JSON array
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'scout_attribution_scout_contributors'
            ) THEN
                ALTER TABLE products ADD COLUMN scout_attribution_scout_contributors JSONB DEFAULT '[]'::jsonb;
            END IF;
            
            -- Linked Product Vote relationship
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'scout_attribution_linked_product_vote'
            ) THEN
                ALTER TABLE products ADD COLUMN scout_attribution_linked_product_vote INTEGER;
            END IF;
            
            -- Scans After Testing counter
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'scout_attribution_scans_after_testing'
            ) THEN
                ALTER TABLE products ADD COLUMN scout_attribution_scans_after_testing INTEGER DEFAULT 0;
            END IF;
        END $$;
    `)

    console.log('[Migration] ✓ scoutAttribution columns added to products')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Removing scoutAttribution columns from products...')

    await db.execute(sql`
        ALTER TABLE products 
        DROP COLUMN IF EXISTS scout_attribution_first_scout,
        DROP COLUMN IF EXISTS scout_attribution_first_scout_number,
        DROP COLUMN IF EXISTS scout_attribution_total_scouts,
        DROP COLUMN IF EXISTS scout_attribution_scout_contributors,
        DROP COLUMN IF EXISTS scout_attribution_linked_product_vote,
        DROP COLUMN IF EXISTS scout_attribution_scans_after_testing;
    `)

    console.log('[Migration] scoutAttribution columns removed')
}
