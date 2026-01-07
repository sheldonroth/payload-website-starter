/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create the products_unmatched_ingredients table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "products_unmatched_ingredients" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "products_unmatched_ingredients" ADD CONSTRAINT "products_unmatched_ingredients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "products_unmatched_ingredients_order_idx" ON "products_unmatched_ingredients" USING btree ("_order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "products_unmatched_ingredients_parent_id_idx" ON "products_unmatched_ingredients" USING btree ("_parent_id")`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "products_unmatched_ingredients" CASCADE`)
}
