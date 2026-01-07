/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add missing global_slug column to payload_locked_documents
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents" ADD COLUMN "global_slug" varchar;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)

  // Add index on global_slug if it doesn't exist
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_global_slug_idx"
    ON "payload_locked_documents" USING btree ("global_slug")
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "payload_locked_documents_global_slug_idx"`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents" DROP COLUMN IF EXISTS "global_slug"`)
}
