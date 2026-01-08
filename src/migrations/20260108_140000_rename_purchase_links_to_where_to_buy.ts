/**
 * Database Migration
 * Renames purchaseLinks to whereToBuy to match frontend expectations
 *
 * Payload stores array fields in separate tables, so we need to:
 * 1. Rename products_purchase_links table to products_where_to_buy
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Renaming purchase_links array table to where_to_buy...')

    // Check if the old array table exists
    const tableCheck = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'products_purchase_links'
        );
    `)

    if (tableCheck.rows[0]?.exists) {
        // Rename the array table
        await db.execute(sql`
            ALTER TABLE products_purchase_links
            RENAME TO products_where_to_buy;
        `)
        console.log('[Migration] Renamed table products_purchase_links to products_where_to_buy')
    } else {
        // Check if products_where_to_buy already exists
        const newTableCheck = await db.execute(sql`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'products_where_to_buy'
            );
        `)

        if (!newTableCheck.rows[0]?.exists) {
            // Neither table exists, create products_where_to_buy
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS "products_where_to_buy" (
                    "_order" integer NOT NULL,
                    "_parent_id" integer NOT NULL,
                    "id" varchar PRIMARY KEY NOT NULL,
                    "retailer" varchar NOT NULL,
                    "url" varchar NOT NULL,
                    "price" varchar,
                    "is_affiliate" boolean DEFAULT true
                );
            `)

            // Add foreign key
            await db.execute(sql`
                DO $$ BEGIN
                    ALTER TABLE "products_where_to_buy"
                    ADD CONSTRAINT "products_where_to_buy_parent_id_fk"
                    FOREIGN KEY ("_parent_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            `)

            // Add index
            await db.execute(sql`
                CREATE INDEX IF NOT EXISTS "products_where_to_buy_order_parent_idx"
                ON "products_where_to_buy" USING btree ("_order", "_parent_id");
            `)

            console.log('[Migration] Created products_where_to_buy table')
        } else {
            console.log('[Migration] products_where_to_buy table already exists, skipping')
        }
    }

    console.log('[Migration] ✓ Array table rename complete')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Renaming products_where_to_buy back to products_purchase_links...')

    await db.execute(sql`
        ALTER TABLE products_where_to_buy
        RENAME TO products_purchase_links;
    `)

    console.log('[Migration] Rollback complete')
}
