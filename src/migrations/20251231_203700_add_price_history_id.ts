import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Comprehensive migration to add ALL missing columns to payload_locked_documents_rels
 * Based on the query error, these columns are expected:
 * - price_history_id
 * - brands_id
 * - regulatory_changes_id
 * - user_submissions_id
 * - payload_folders_id
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add all potentially missing columns to payload_locked_documents_rels
  const columns = [
    'price_history_id',
    'brands_id',
    'regulatory_changes_id',
    'user_submissions_id',
    'payload_folders_id'
  ];

  for (const column of columns) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "${column}" integer;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `));

    // Add index for each column
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_${column}_idx" 
      ON "payload_locked_documents_rels" USING btree ("${column}")
    `));
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  const columns = [
    'price_history_id',
    'brands_id',
    'regulatory_changes_id',
    'user_submissions_id',
    'payload_folders_id'
  ];

  for (const column of columns) {
    await db.execute(sql.raw(`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "${column}"`));
  }
}
