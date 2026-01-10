/**
 * Database Migration - Create Paywall Settings Global
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create paywall_settings global table
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating paywall_settings global...')

    // Create enum for mode (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_paywall_settings_mode') THEN
                CREATE TYPE "public"."enum_paywall_settings_mode" AS ENUM(
                    'statsig',
                    'cms_ab_test',
                    'fixed'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for price display format (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_paywall_settings_price_display_format') THEN
                CREATE TYPE "public"."enum_paywall_settings_price_display_format" AS ENUM(
                    'monthly',
                    'weekly',
                    'annual_monthly',
                    'annual_total'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create paywall_settings global table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "paywall_settings" (
            "id" serial PRIMARY KEY NOT NULL,
            "mode" "enum_paywall_settings_mode" DEFAULT 'fixed',
            "fixed_variant_id" integer,
            "statsig_experiment_name" varchar,
            "statsig_parameter_name" varchar DEFAULT 'variantId',
            "ab_test_description" varchar,
            "fallback_variant_id" integer,
            "show_paywall" boolean DEFAULT true,
            "force_paywall_for_all" boolean DEFAULT false,
            "delay_before_show" numeric DEFAULT 0,
            "min_sessions_before_paywall" numeric DEFAULT 0,
            "default_trial_days" numeric DEFAULT 7,
            "show_pricing" boolean DEFAULT true,
            "price_display_format" "enum_paywall_settings_price_display_format" DEFAULT 'monthly',
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Add foreign keys to paywall_variants
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "paywall_settings"
            ADD CONSTRAINT "paywall_settings_fixed_variant_id_paywall_variants_id_fk"
            FOREIGN KEY ("fixed_variant_id") REFERENCES "paywall_variants"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "paywall_settings"
            ADD CONSTRAINT "paywall_settings_fallback_variant_id_paywall_variants_id_fk"
            FOREIGN KEY ("fallback_variant_id") REFERENCES "paywall_variants"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Insert default settings
    await db.execute(sql`
        INSERT INTO "paywall_settings" (
            "mode",
            "show_paywall",
            "default_trial_days",
            "show_pricing",
            "price_display_format"
        ) VALUES (
            'fixed',
            true,
            7,
            true,
            'monthly'
        )
        ON CONFLICT DO NOTHING;
    `)

    console.log('[Migration] Paywall settings global created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back paywall_settings...')

    await db.execute(sql`DROP TABLE IF EXISTS "paywall_settings" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_paywall_settings_mode";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_paywall_settings_price_display_format";`)

    console.log('[Migration] Paywall settings rollback completed')
}
