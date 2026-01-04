import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add automation thresholds columns to site_settings table
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add the automation thresholds columns - each needs its own statement
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_freshness_threshold_days" integer DEFAULT 180;
    `)
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_fuzzy_match_threshold" integer DEFAULT 2;
    `)
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_auto_alternatives_limit" integer DEFAULT 3;
    `)
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_ai_category_confidence" integer DEFAULT 70;
    `)
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_enable_fuzzy_matching" boolean DEFAULT true;
    `)
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_enable_ai_categories" boolean DEFAULT true;
    `)
    await db.execute(sql`
        ALTER TABLE "site_settings"
        ADD COLUMN IF NOT EXISTS "automation_thresholds_enable_auto_alternatives" boolean DEFAULT true;
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "site_settings"
        DROP COLUMN IF EXISTS "automation_thresholds_freshness_threshold_days",
        DROP COLUMN IF EXISTS "automation_thresholds_fuzzy_match_threshold",
        DROP COLUMN IF EXISTS "automation_thresholds_auto_alternatives_limit",
        DROP COLUMN IF EXISTS "automation_thresholds_ai_category_confidence",
        DROP COLUMN IF EXISTS "automation_thresholds_enable_fuzzy_matching",
        DROP COLUMN IF EXISTS "automation_thresholds_enable_ai_categories",
        DROP COLUMN IF EXISTS "automation_thresholds_enable_auto_alternatives";
    `)
}
