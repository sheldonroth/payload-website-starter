/**
 * Database Migration
 * Renames purchaseLinks to whereToBuy to match frontend expectations
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Renaming purchase_links to where_to_buy...')

    // Check if the old column exists
    const columnCheck = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_name = 'products'
            AND column_name = 'purchase_links'
        );
    `)

    if (columnCheck.rows[0]?.exists) {
        // Rename the column
        await db.execute(sql`
            ALTER TABLE products
            RENAME COLUMN purchase_links TO where_to_buy;
        `)
        console.log('[Migration] Renamed purchase_links to where_to_buy')
    } else {
        // Check if where_to_buy already exists
        const newColumnCheck = await db.execute(sql`
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_name = 'products'
                AND column_name = 'where_to_buy'
            );
        `)

        if (!newColumnCheck.rows[0]?.exists) {
            // Neither column exists, create where_to_buy
            await db.execute(sql`
                ALTER TABLE products
                ADD COLUMN IF NOT EXISTS where_to_buy jsonb DEFAULT '[]'::jsonb;
            `)
            console.log('[Migration] Created where_to_buy column')
        } else {
            console.log('[Migration] where_to_buy column already exists, skipping')
        }
    }

    console.log('[Migration] ✓ Column rename complete')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Renaming where_to_buy back to purchase_links...')

    await db.execute(sql`
        ALTER TABLE products
        RENAME COLUMN where_to_buy TO purchase_links;
    `)

    console.log('[Migration] Rollback complete')
}
