/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix payload_locked_documents__rels table (double underscore)
 *
 * The newer Payload CMS versions use double underscore naming convention.
 * This migration adds missing columns and migrates data from _rels to __rels.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Check if payload_locked_documents__rels table exists (double underscore)
  // If it doesn't exist, skip this migration as it's for newer Payload versions
  const tableCheckResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'payload_locked_documents__rels'
    ) as exists;
  `)

  const tableExists = tableCheckResult.rows?.[0]?.exists ?? false

  if (!tableExists) {
    console.log('[Migration] payload_locked_documents__rels table does not exist, skipping migration')
    return
  }

  // Add missing columns to payload_locked_documents__rels
  const missingColumns = [
    'payload_folders_id',
    'device_fingerprints_id',
    'product_unlocks_id',
    'trending_news_id',
    'product_votes_id',
    'push_tokens_id',
    'feedback_id',
    'referrals_id',
    'referral_payouts_id'
  ]

  for (const col of missingColumns) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "payload_locked_documents__rels" ADD COLUMN "${col}" integer;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `))
  }

  // Add foreign key constraints for new columns
  const fkMappings = [
    { col: 'payload_folders_id', table: 'payload_folders' },
    { col: 'device_fingerprints_id', table: 'device_fingerprints' },
    { col: 'product_unlocks_id', table: 'product_unlocks' },
    { col: 'trending_news_id', table: 'trending_news' },
    { col: 'product_votes_id', table: 'product_votes' },
    { col: 'push_tokens_id', table: 'push_tokens' },
    { col: 'feedback_id', table: 'feedback' },
    { col: 'referrals_id', table: 'referrals' },
    { col: 'referral_payouts_id', table: 'referral_payouts' }
  ]

  for (const { col, table } of fkMappings) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "payload_locked_documents__rels"
        ADD CONSTRAINT "payload_locked_documents__rels_${col.replace('_id', '')}_fk"
        FOREIGN KEY ("${col}")
        REFERENCES "public"."${table}"("id")
        ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `))

    // Add index
    await db.execute(sql.raw(`
      CREATE INDEX IF NOT EXISTS "payload_locked_documents__rels_${col}_idx"
      ON "payload_locked_documents__rels" USING btree ("${col}")
    `))
  }

  // Migrate data from _rels to __rels if any exists
  await db.execute(sql`
    INSERT INTO "payload_locked_documents__rels" (
      "order", "parent_id", "path", "pages_id", "posts_id", "media_id",
      "categories_id", "users_id", "redirects_id", "forms_id",
      "form_submissions_id", "search_id", "products_id", "articles_id",
      "videos_id", "investigation_polls_id", "ingredients_id",
      "verdict_rules_id", "audit_log_id", "sponsored_test_requests_id",
      "price_history_id", "brands_id", "regulatory_changes_id",
      "user_submissions_id", "payload_folders_id", "device_fingerprints_id",
      "product_unlocks_id", "trending_news_id", "product_votes_id",
      "push_tokens_id", "feedback_id", "referrals_id", "referral_payouts_id"
    )
    SELECT
      "order", "parent_id", "path", "pages_id", "posts_id", "media_id",
      "categories_id", "users_id", "redirects_id", "forms_id",
      "form_submissions_id", "search_id", "products_id", "articles_id",
      "videos_id", "investigation_polls_id", "ingredients_id",
      "verdict_rules_id", "audit_log_id", "sponsored_test_requests_id",
      "price_history_id", "brands_id", "regulatory_changes_id",
      "user_submissions_id", "payload_folders_id", "device_fingerprints_id",
      "product_unlocks_id", "trending_news_id", "product_votes_id",
      "push_tokens_id", "feedback_id", "referrals_id", "referral_payouts_id"
    FROM "payload_locked_documents_rels"
    WHERE NOT EXISTS (
      SELECT 1 FROM "payload_locked_documents__rels"
      WHERE "payload_locked_documents__rels"."parent_id" = "payload_locked_documents_rels"."parent_id"
      AND "payload_locked_documents__rels"."path" = "payload_locked_documents_rels"."path"
    )
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Nothing to do - we don't want to remove data
}
