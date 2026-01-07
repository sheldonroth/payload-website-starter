/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add missing category array tables
 *
 * The Categories collection has freeFromList and avoidReasons array fields
 * that were added but the database tables weren't created.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Create categories_free_from_list table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "categories_free_from_list" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "risk_category" varchar,
            "description" varchar
        );
    `)

    // Create index for parent reference
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "categories_free_from_list_order_idx"
        ON "categories_free_from_list" ("_order");
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "categories_free_from_list_parent_id_idx"
        ON "categories_free_from_list" ("_parent_id");
    `)

    // Create foreign key to categories
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "categories_free_from_list"
            ADD CONSTRAINT "categories_free_from_list_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create categories_avoid_reasons table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "categories_avoid_reasons" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "reason" varchar
        );
    `)

    // Create indexes for avoid_reasons
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "categories_avoid_reasons_order_idx"
        ON "categories_avoid_reasons" ("_order");
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "categories_avoid_reasons_parent_id_idx"
        ON "categories_avoid_reasons" ("_parent_id");
    `)

    // Create foreign key to categories
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "categories_avoid_reasons"
            ADD CONSTRAINT "categories_avoid_reasons_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Created categories_free_from_list and categories_avoid_reasons tables')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        DROP TABLE IF EXISTS "categories_free_from_list" CASCADE;
        DROP TABLE IF EXISTS "categories_avoid_reasons" CASCADE;
    `)
}
