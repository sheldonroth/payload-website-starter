/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
/**
 * Migration: Create Push Tokens Table
 *
 * Creates the push_tokens table for storing Expo push notification tokens
 * and product notification subscriptions.
 */

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create push_tokens table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "push_tokens" (
      "id" serial PRIMARY KEY,
      "token" varchar UNIQUE NOT NULL,
      "fingerprint_hash" varchar,
      "platform" varchar DEFAULT 'ios',
      "is_active" boolean DEFAULT true,
      "last_used" timestamp(3) with time zone,
      "failure_count" numeric DEFAULT 0,
      "product_subscriptions" jsonb DEFAULT '[]'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create indexes for common queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "push_tokens_token_idx" ON "push_tokens" USING btree ("token");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "push_tokens_fingerprint_hash_idx" ON "push_tokens" USING btree ("fingerprint_hash");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "push_tokens_is_active_idx" ON "push_tokens" USING btree ("is_active");
  `)

  // Create GIN index for JSONB array searches (for finding subscribers by barcode)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "push_tokens_subscriptions_idx" ON "push_tokens" USING gin ("product_subscriptions");
  `)

  console.log('[Migration] Created push_tokens table with indexes')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "push_tokens" CASCADE;`)
  console.log('[Migration] Dropped push_tokens table')
}
