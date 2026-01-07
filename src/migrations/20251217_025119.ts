/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_subscription_status" AS ENUM('free', 'trial', 'premium', 'cancelled');
  ALTER TABLE "products" ALTER COLUMN "category_id" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "subscription_status" "enum_users_subscription_status" DEFAULT 'free';
  ALTER TABLE "users" ADD COLUMN "trial_start_date" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "trial_end_date" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "product_views_this_month" numeric DEFAULT 0;
  ALTER TABLE "users" ADD COLUMN "product_views_reset_date" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" varchar;
  ALTER TABLE "users" ADD COLUMN "revenuecat_user_id" varchar;
  ALTER TABLE "users" ADD COLUMN "google_id" varchar;
  ALTER TABLE "users" ADD COLUMN "apple_id" varchar;
  ALTER TABLE "users" ADD COLUMN "privacy_consent_data_processing_consent" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "privacy_consent_consent_date" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "privacy_consent_marketing_opt_in" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "saved_product_ids" jsonb DEFAULT '[]'::jsonb;
  ALTER TABLE "users" ADD COLUMN "saved_article_ids" jsonb DEFAULT '[]'::jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "category_id" SET NOT NULL;
  ALTER TABLE "users" DROP COLUMN "subscription_status";
  ALTER TABLE "users" DROP COLUMN "trial_start_date";
  ALTER TABLE "users" DROP COLUMN "trial_end_date";
  ALTER TABLE "users" DROP COLUMN "product_views_this_month";
  ALTER TABLE "users" DROP COLUMN "product_views_reset_date";
  ALTER TABLE "users" DROP COLUMN "stripe_customer_id";
  ALTER TABLE "users" DROP COLUMN "stripe_subscription_id";
  ALTER TABLE "users" DROP COLUMN "revenuecat_user_id";
  ALTER TABLE "users" DROP COLUMN "google_id";
  ALTER TABLE "users" DROP COLUMN "apple_id";
  ALTER TABLE "users" DROP COLUMN "privacy_consent_data_processing_consent";
  ALTER TABLE "users" DROP COLUMN "privacy_consent_consent_date";
  ALTER TABLE "users" DROP COLUMN "privacy_consent_marketing_opt_in";
  ALTER TABLE "users" DROP COLUMN "saved_product_ids";
  ALTER TABLE "users" DROP COLUMN "saved_article_ids";
  DROP TYPE "public"."enum_users_subscription_status";`)
}
