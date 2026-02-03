/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Ensure subscription status enum supports the states used by Stripe + our app.
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_subscription_status') THEN
        BEGIN
          ALTER TYPE "public"."enum_users_subscription_status" ADD VALUE IF NOT EXISTS 'past_due';
        EXCEPTION WHEN duplicate_object THEN null;
        END;

        BEGIN
          ALTER TYPE "public"."enum_users_subscription_status" ADD VALUE IF NOT EXISTS 'unpaid';
        EXCEPTION WHEN duplicate_object THEN null;
        END;
      END IF;
    END $$;

    -- Subscription plan enum (monthly vs annual)
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_subscription_plan" AS ENUM('monthly', 'annual');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Core subscription fields (used for renewal reminders + cancellation UX)
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_plan" "enum_users_subscription_plan";
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_end_date" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cancel_at_period_end" boolean DEFAULT false;

    -- Renewal reminder send log (prevents duplicates)
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "annual_renewal_reminder_last_sent_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "annual_renewal_reminder_for_period_end" timestamp(3) with time zone;

    -- Clickwrap / consent logging (enforceability)
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_terms_of_service_accepted" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_terms_of_service_timestamp" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_terms_of_service_version" varchar;

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_liability_and_forum_accepted" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_liability_and_forum_timestamp" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_liability_and_forum_version" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_liability_and_forum_jurisdiction" varchar;

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_ip_address" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_user_agent" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_recorded_at" timestamp(3) with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consent_log_marketing_opt_in" boolean DEFAULT false;

    -- Mobile store metadata (RevenueCat) for correct cancellation routing + renewal notices
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_store" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_product_id" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_currency" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_price" numeric;

    -- Helpful indexes for daily reminder query
    CREATE INDEX IF NOT EXISTS "users_subscription_end_date_idx" ON "users" USING btree ("subscription_end_date");
    CREATE INDEX IF NOT EXISTS "users_subscription_plan_idx" ON "users" USING btree ("subscription_plan");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_subscription_end_date_idx";
    DROP INDEX IF EXISTS "users_subscription_plan_idx";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_plan";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_end_date";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "cancel_at_period_end";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "annual_renewal_reminder_last_sent_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "annual_renewal_reminder_for_period_end";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_terms_of_service_accepted";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_terms_of_service_timestamp";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_terms_of_service_version";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_liability_and_forum_accepted";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_liability_and_forum_timestamp";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_liability_and_forum_version";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_liability_and_forum_jurisdiction";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_ip_address";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_user_agent";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_recorded_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "consent_log_marketing_opt_in";

    ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_store";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_product_id";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_currency";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "subscription_price";

    DROP TYPE IF EXISTS "public"."enum_users_subscription_plan";

    -- NOTE: We do not remove added enum values from enum_users_subscription_status in down().
  `)
}
