import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add missing columns to categories table
 *
 * The whatWeFound field was added to Categories but the column wasn't created.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add whatWeFound column (richText stored as JSON)
    await db.execute(sql`
        ALTER TABLE "categories"
        ADD COLUMN IF NOT EXISTS "what_we_found" jsonb;
    `)

    console.log('[Migration] Added what_we_found column to categories')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "categories"
        DROP COLUMN IF EXISTS "what_we_found";
    `)
}
