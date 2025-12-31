import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    // Add price_history_id column to payload_locked_documents_rels
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "price_history_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)

    // Add index for the new column
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_price_history_id_idx" ON "payload_locked_documents_rels" USING btree ("price_history_id")`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "price_history_id"`)
}
