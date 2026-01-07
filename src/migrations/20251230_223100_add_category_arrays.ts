/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories_harmful_ingredients" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "ingredient" varchar,
      "reason" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories_quality_indicators" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "indicator" varchar,
      "description" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "categories_harmful_ingredients" ADD CONSTRAINT "categories_harmful_ingredients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "categories_quality_indicators" ADD CONSTRAINT "categories_quality_indicators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "categories_harmful_ingredients_order_idx" ON "categories_harmful_ingredients" USING btree ("_order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "categories_harmful_ingredients_parent_id_idx" ON "categories_harmful_ingredients" USING btree ("_parent_id")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "categories_quality_indicators_order_idx" ON "categories_quality_indicators" USING btree ("_order")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "categories_quality_indicators_parent_id_idx" ON "categories_quality_indicators" USING btree ("_parent_id")`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "categories_harmful_ingredients" CASCADE;
    DROP TABLE IF EXISTS "categories_quality_indicators" CASCADE;
  `)
}
