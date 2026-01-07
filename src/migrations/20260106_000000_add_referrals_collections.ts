/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Referrals collection and update payload_locked_documents_rels
 *
 * Creates the referrals table and adds missing columns to payload_locked_documents_rels
 * to support the referral program.
 *
 * Note: referral_payouts table already exists with a legacy schema.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Create enum for referral status
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_referrals_status" AS ENUM ('pending', 'active', 'churned', 'fraud');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create enum for referral source
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_referrals_source" AS ENUM ('mobile', 'web', 'link');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create referrals table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "referrals" (
            "id" serial PRIMARY KEY NOT NULL,
            "referrer_id" varchar NOT NULL,
            "referral_code" varchar NOT NULL,
            "referrer_email" varchar,
            "referred_device_id" varchar NOT NULL,
            "referred_user_id" varchar,
            "referred_email" varchar,
            "status" "enum_referrals_status" DEFAULT 'pending' NOT NULL,
            "first_subscription_date" timestamp(3) with time zone,
            "last_renewal_date" timestamp(3) with time zone,
            "next_commission_date" timestamp(3) with time zone,
            "total_commission_paid" numeric DEFAULT 0,
            "years_active" numeric DEFAULT 0,
            "revenuecat_subscriber_id" varchar,
            "source" "enum_referrals_source" DEFAULT 'mobile',
            "notes" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Create indexes for referrals
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referrals_referrer_id_idx" ON "referrals" ("referrer_id");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referrals_referral_code_idx" ON "referrals" ("referral_code");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referrals_referred_device_id_idx" ON "referrals" ("referred_device_id");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals" ("status");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referrals_revenuecat_subscriber_id_idx" ON "referrals" ("revenuecat_subscriber_id");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referrals_referrer_id_status_idx" ON "referrals" ("referrer_id", "status");
    `)
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "referrals_referred_device_id_unique_idx" ON "referrals" ("referred_device_id");
    `)

    // Add missing columns to payload_locked_documents_rels
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referrals_id" integer;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "referral_payouts_id" integer;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)

    // Add foreign key constraints
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_referrals_fk"
            FOREIGN KEY ("referrals_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_referral_payouts_fk"
            FOREIGN KEY ("referral_payouts_id") REFERENCES "referral_payouts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Created referrals and referral_payouts collections')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Remove foreign keys from payload_locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referrals_fk";
        ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_referral_payouts_fk";
    `)

    // Remove columns from payload_locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referrals_id";
        ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "referral_payouts_id";
    `)

    // Drop tables
    await db.execute(sql`
        DROP TABLE IF EXISTS "referral_payouts_referral_breakdown" CASCADE;
        DROP TABLE IF EXISTS "referral_payouts" CASCADE;
        DROP TABLE IF EXISTS "referrals" CASCADE;
    `)

    // Drop enums
    await db.execute(sql`
        DROP TYPE IF EXISTS "enum_referrals_status";
        DROP TYPE IF EXISTS "enum_referrals_source";
        DROP TYPE IF EXISTS "enum_referral_payouts_status";
        DROP TYPE IF EXISTS "enum_referral_payouts_payment_method";
    `)
}
