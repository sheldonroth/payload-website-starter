/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create the enum type first (before the table that uses it)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_sponsored_test_requests_status" AS ENUM('pending', 'testing', 'complete', 'refunded');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Create the sponsored_test_requests table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "sponsored_test_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "product_name" varchar NOT NULL,
      "email" varchar NOT NULL,
      "stripe_payment_id" varchar,
      "status" "enum_sponsored_test_requests_status" DEFAULT 'pending' NOT NULL,
      "notes" varchar,
      "report_url" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "sponsored_test_requests_updated_at_idx" ON "sponsored_test_requests" USING btree ("updated_at")`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "sponsored_test_requests_created_at_idx" ON "sponsored_test_requests" USING btree ("created_at")`)

  // Add sponsored_test_requests_id column to payload_locked_documents_rels
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sponsored_test_requests_id" integer;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)

  // Add foreign key constraint
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sponsored_test_requests_fk" FOREIGN KEY ("sponsored_test_requests_id") REFERENCES "public"."sponsored_test_requests"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

  // Add index
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sponsored_test_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("sponsored_test_requests_id")`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sponsored_test_requests_id"`)
  await db.execute(sql`DROP TABLE IF EXISTS "sponsored_test_requests" CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_sponsored_test_requests_status"`)
}
