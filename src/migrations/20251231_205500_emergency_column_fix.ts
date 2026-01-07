/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * EMERGENCY FIX: Add ALL missing columns to payload_locked_documents_rels
 * This is a fresh migration name to ensure it runs
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Starting emergency column fix...')

    // Add price_history_id
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_history_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
    console.log('[Migration] Added price_history_id')

    // Add brands_id
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "brands_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
    console.log('[Migration] Added brands_id')

    // Add regulatory_changes_id
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "regulatory_changes_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
    console.log('[Migration] Added regulatory_changes_id')

    // Add user_submissions_id
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "user_submissions_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
    console.log('[Migration] Added user_submissions_id')

    // Add payload_folders_id
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_folders_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
    console.log('[Migration] Added payload_folders_id')

    console.log('[Migration] Emergency column fix complete!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "price_history_id"`)
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "brands_id"`)
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "regulatory_changes_id"`)
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "user_submissions_id"`)
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "payload_folders_id"`)
}
