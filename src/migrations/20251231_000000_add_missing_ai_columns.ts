/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create enum types for ai_confidence and ai_source_type
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_products_ai_confidence" AS ENUM('high', 'medium', 'low');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_products_ai_source_type" AS ENUM('transcript', 'video_watching', 'profile', 'manual');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Add missing columns to products table
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "products" ADD COLUMN "ai_confidence" "enum_products_ai_confidence";
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "products" ADD COLUMN "ai_source_type" "enum_products_ai_source_type";
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "products" ADD COLUMN "ai_mentions" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "ai_confidence"`)
  await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "ai_source_type"`)
  await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "ai_mentions"`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_products_ai_confidence"`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_products_ai_source_type"`)
}
