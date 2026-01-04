-- Run this SQL on your Vercel Postgres database to add automation thresholds columns
-- Go to: Vercel Dashboard > Your Project > Storage > Your Postgres DB > Query

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_freshness_threshold_days" integer DEFAULT 180;

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_fuzzy_match_threshold" integer DEFAULT 2;

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_auto_alternatives_limit" integer DEFAULT 3;

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_ai_category_confidence" integer DEFAULT 70;

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_enable_fuzzy_matching" boolean DEFAULT true;

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_enable_ai_categories" boolean DEFAULT true;

ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "automation_thresholds_enable_auto_alternatives" boolean DEFAULT true;

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'site_settings'
AND column_name LIKE 'automation_thresholds%';
