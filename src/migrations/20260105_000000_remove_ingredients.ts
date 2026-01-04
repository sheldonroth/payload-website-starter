import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * STRIP INGREDIENTS - LIABILITY SHIELD STRATEGY
 * 
 * Removes all ingredient-level data from the database to ensure legal defensibility.
 * This is a destructive migration.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Removing ingredient-related data (Liability Shield)...')

    // 1. Drop ingredient-related columns from products table
    // Using IF EXISTS to be safe regardless of exact schema history
    await db.execute(sql`
    ALTER TABLE "products" 
    DROP COLUMN IF EXISTS "ingredients_raw",
    DROP COLUMN IF EXISTS "ingredients_list",
    DROP COLUMN IF EXISTS "unmatched_ingredients";
  `)

    // 2. Drop possible array/relationship tables associated with ingredients
    // Payload creates separate tables for array fields and relationships
    await db.execute(sql`
    DROP TABLE IF EXISTS "products_ingredients_list"; 
    DROP TABLE IF EXISTS "products_unmatched_ingredients";
  `)

    // 3. Drop the entire Ingredients collection table and its relations
    // Using CASCADE to drop dependent foreign key constraints
    await db.execute(sql`
    DROP TABLE IF EXISTS "ingredients_rels" CASCADE;
    DROP TABLE IF EXISTS "ingredients_locales" CASCADE;
    DROP TABLE IF EXISTS "ingredients" CASCADE;
  `)

    console.log('[Migration] Ingredient data removed')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    // We cannot restore deleted data, but we can restore the schema structure
    console.log('[Migration] WARN: Restoring ingredient schema (data is lost)')

    await db.execute(sql`
    ALTER TABLE "products" 
    ADD COLUMN IF NOT EXISTS "ingredients_raw" varchar;
  `)

    // Note: Recreating full tables for arrays/collections is complex and 
    // generally "down" migrations for destructive changes are not fully reversible.
}
