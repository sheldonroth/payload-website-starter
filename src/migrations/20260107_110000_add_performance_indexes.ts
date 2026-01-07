import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Performance Indexes Migration
 *
 * Adds database indexes for frequently queried columns to optimize
 * query performance on the Neon PostgreSQL database.
 *
 * Indexes added:
 * 1. contributor_profiles(shareable_slug) - UNIQUE for public profile lookups
 * 2. contributor_profiles(fingerprint_hash) - UNIQUE for device-based profile lookups
 * 3. contributor_profiles(contributor_number) - UNIQUE for contributor number lookups
 * 4. products(brand, category_id) - compound index for filtered product lists
 * 5. brand_analytics(brand_id, date) - compound index for date range queries
 * 6. device_fingerprints(subscription_status, created_at) - compound for analytics
 * 7. videos(youtube_video_id) - UNIQUE for video deduplication
 * 8. product_votes(barcode) - index for barcode lookups
 * 9. referrals(referrer_id) - index for referrer queries
 * 10. email_sends(recipient, template) - compound for deduplication checks
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding performance indexes...')

    // ═══════════════════════════════════════════════════════════════════════
    // 1. contributor_profiles(shareable_slug) - UNIQUE for public profile lookups
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_contributor_profiles_shareable_slug"
        ON "contributor_profiles" ("shareable_slug")
        WHERE "shareable_slug" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on contributor_profiles(shareable_slug)')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. contributor_profiles(fingerprint_hash) - UNIQUE for device lookup
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_contributor_profiles_fingerprint_hash"
        ON "contributor_profiles" ("fingerprint_hash")
        WHERE "fingerprint_hash" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on contributor_profiles(fingerprint_hash)')

    // ═══════════════════════════════════════════════════════════════════════
    // 3. contributor_profiles(contributor_number) - UNIQUE for contributor lookups
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_contributor_profiles_contributor_number"
        ON "contributor_profiles" ("contributor_number")
        WHERE "contributor_number" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on contributor_profiles(contributor_number)')

    // ═══════════════════════════════════════════════════════════════════════
    // 4. products(brand, category_id) - compound index for filtering
    // Optimizes queries like: WHERE brand = 'X' AND category_id = Y
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_products_brand_category"
        ON "products" ("brand", "category_id");
    `)
    console.log('[Migration] Created compound index on products(brand, category_id)')

    // ═══════════════════════════════════════════════════════════════════════
    // 5. brand_analytics(brand_id, date) - compound for time-series/date range queries
    // Optimizes queries like: WHERE brand_id = X AND date BETWEEN Y AND Z
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_brand_analytics_brand_date"
        ON "brand_analytics" ("brand_id", "date" DESC);
    `)
    console.log('[Migration] Created compound index on brand_analytics(brand_id, date)')

    // ═══════════════════════════════════════════════════════════════════════
    // 6. device_fingerprints(subscription_status, created_at) - compound for analytics
    // Optimizes queries filtering by subscription status with time-based analytics
    // Note: Creates index only if subscription_status column exists (may be added later)
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'device_fingerprints'
                AND column_name = 'subscription_status'
            ) THEN
                CREATE INDEX IF NOT EXISTS "idx_device_fingerprints_subscription_created"
                ON "device_fingerprints" ("subscription_status", "created_at" DESC);
            END IF;
        END $$;
    `)
    console.log('[Migration] Created compound index on device_fingerprints(subscription_status, created_at) if column exists')

    // Also add index for suspicious_score for fraud detection queries
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_device_fingerprints_suspicious_score"
        ON "device_fingerprints" ("suspicious_score" DESC)
        WHERE "suspicious_score" > 0;
    `)
    console.log('[Migration] Created partial index on device_fingerprints(suspicious_score)')

    // ═══════════════════════════════════════════════════════════════════════
    // 7. videos(youtube_video_id) - UNIQUE for video deduplication
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_videos_youtube_video_id"
        ON "videos" ("youtube_video_id")
        WHERE "youtube_video_id" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on videos(youtube_video_id)')

    // ═══════════════════════════════════════════════════════════════════════
    // 8. product_votes(barcode) - index for barcode lookups
    // Note: The barcode column already has a UNIQUE constraint from table creation
    // This adds a named index for clarity and performance monitoring
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_product_votes_barcode"
        ON "product_votes" ("barcode");
    `)
    console.log('[Migration] Created index on product_votes(barcode)')

    // ═══════════════════════════════════════════════════════════════════════
    // 9. referrals(referrer_id) - index for referrer queries
    // Optimizes queries finding all referrals by a specific referrer
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_referrals_referrer_id"
        ON "referrals" ("referrer_id");
    `)
    console.log('[Migration] Created index on referrals(referrer_id)')

    // ═══════════════════════════════════════════════════════════════════════
    // 10. email_sends(recipient, template) - compound for deduplication checks
    // Optimizes queries checking if a template was already sent to a recipient
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_email_sends_recipient_template"
        ON "email_sends" ("recipient", "template");
    `)
    console.log('[Migration] Created compound index on email_sends(recipient, template)')

    // Additional useful index for recent sends lookup by recipient
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_email_sends_recipient_sent_at"
        ON "email_sends" ("recipient", "sent_at" DESC);
    `)
    console.log('[Migration] Created compound index on email_sends(recipient, sent_at)')

    console.log('[Migration] All performance indexes created successfully!')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Removing performance indexes...')

    // Drop all indexes created by this migration
    await db.execute(sql`
        DROP INDEX IF EXISTS "idx_contributor_profiles_shareable_slug";
        DROP INDEX IF EXISTS "idx_contributor_profiles_fingerprint_hash";
        DROP INDEX IF EXISTS "idx_contributor_profiles_contributor_number";
        DROP INDEX IF EXISTS "idx_products_brand_category";
        DROP INDEX IF EXISTS "idx_brand_analytics_brand_date";
        DROP INDEX IF EXISTS "idx_device_fingerprints_subscription_created";
        DROP INDEX IF EXISTS "idx_device_fingerprints_suspicious_score";
        DROP INDEX IF EXISTS "idx_videos_youtube_video_id";
        DROP INDEX IF EXISTS "idx_product_votes_barcode";
        DROP INDEX IF EXISTS "idx_referrals_referrer_id";
        DROP INDEX IF EXISTS "idx_email_sends_recipient_template";
        DROP INDEX IF EXISTS "idx_email_sends_recipient_sent_at";
    `)

    console.log('[Migration] Performance indexes removed')
}
