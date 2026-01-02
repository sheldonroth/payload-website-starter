import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add displayTitle field to products table
 * Combines brand + name for better identification in relationship pickers
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add the column
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "display_title" varchar;
    `)

    // Populate existing rows with "Brand - Name" format
    await db.execute(sql`
        UPDATE "products"
        SET "display_title" = CONCAT("brand", ' - ', "name")
        WHERE "display_title" IS NULL;
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "products" DROP COLUMN IF EXISTS "display_title";
    `)
}
