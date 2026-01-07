import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Performance Indexes Migration
 *
 * Adds database indexes for frequently queried columns to optimize
 * query performance on the Neon PostgreSQL database.
 *
 * Indexes added:
 * 1. contributor_profiles(shareable_slug) - UNIQUE for public profile lookups
 * 2. contributor_profiles(fingerprint_hash) - device-based profile lookups
 * 3. products(brand, category_id) - compound index for filtered product lists
 * 4. brand_analytics(brand_id, date) - already exists, adding if missing
 * 5. device_fingerprints(is_banned, created_at) - analytics queries
 * 6. videos(youtube_video_id) - UNIQUE for video deduplication
 * 7. product_votes(barcode) - already exists but ensuring uniqueness
 * 8. email_sends(template, recipient) - deduplication checks
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding performance indexes...')

    // ═══════════════════════════════════════════════════════════════════════
    // 1. contributor_profiles(shareable_slug) - unique lookup for public profiles
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_contributor_profiles_shareable_slug"
        ON "contributor_profiles" ("shareable_slug")
        WHERE "shareable_slug" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on contributor_profiles(shareable_slug)')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. contributor_profiles(fingerprint_hash) - device lookup
    // Note: This should already be unique per the collection definition,
    // but ensuring the index exists
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_contributor_profiles_fingerprint_hash"
        ON "contributor_profiles" ("fingerprint_hash")
        WHERE "fingerprint_hash" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on contributor_profiles(fingerprint_hash)')

    // ═══════════════════════════════════════════════════════════════════════
    // 3. products(brand, category_id) - compound index for filtering
    // Optimizes queries like: WHERE brand = 'X' AND category_id = Y
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_products_brand_category"
        ON "products" ("brand", "category_id");
    `)
    console.log('[Migration] Created compound index on products(brand, category_id)')

    // ═══════════════════════════════════════════════════════════════════════
    // 4. brand_analytics(brand_id, date) - time-series queries
    // Note: This already exists as brand_analytics_brand_date_idx but ensuring
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_brand_analytics_brand_date"
        ON "brand_analytics" ("brand_id", "date" DESC);
    `)
    console.log('[Migration] Created/verified compound index on brand_analytics(brand_id, date)')

    // ═══════════════════════════════════════════════════════════════════════
    // 5. device_fingerprints analytics index
    // Optimizes queries filtering by ban status and time-based analytics
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_device_fingerprints_banned_created"
        ON "device_fingerprints" ("is_banned", "created_at");
    `)
    console.log('[Migration] Created compound index on device_fingerprints(is_banned, created_at)')

    // Also add index for suspicious_score for fraud detection queries
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_device_fingerprints_suspicious_score"
        ON "device_fingerprints" ("suspicious_score" DESC)
        WHERE "suspicious_score" > 0;
    `)
    console.log('[Migration] Created partial index on device_fingerprints(suspicious_score)')

    // ═══════════════════════════════════════════════════════════════════════
    // 6. videos(youtube_video_id) - unique lookup for video deduplication
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "idx_videos_youtube_video_id"
        ON "videos" ("youtube_video_id")
        WHERE "youtube_video_id" IS NOT NULL;
    `)
    console.log('[Migration] Created unique index on videos(youtube_video_id)')

    // ═══════════════════════════════════════════════════════════════════════
    // 7. product_votes(barcode) - ensure uniqueness (already has index)
    // The barcode is already marked as UNIQUE in table definition,
    // but adding explicit unique index name for clarity
    // ═══════════════════════════════════════════════════════════════════════
    // Note: product_votes_barcode_idx already exists, and barcode has UNIQUE constraint
    // No additional index needed

    // ═══════════════════════════════════════════════════════════════════════
    // 8. email_sends(template, recipient) - deduplication checks
    // Optimizes queries checking if a template was already sent to a recipient
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_email_sends_template_recipient"
        ON "email_sends" ("template", "recipient");
    `)
    console.log('[Migration] Created compound index on email_sends(template, recipient)')

    // Additional useful index for recent sends lookup
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
        DROP INDEX IF EXISTS "idx_products_brand_category";
        DROP INDEX IF EXISTS "idx_brand_analytics_brand_date";
        DROP INDEX IF EXISTS "idx_device_fingerprints_banned_created";
        DROP INDEX IF EXISTS "idx_device_fingerprints_suspicious_score";
        DROP INDEX IF EXISTS "idx_videos_youtube_video_id";
        DROP INDEX IF EXISTS "idx_email_sends_template_recipient";
        DROP INDEX IF EXISTS "idx_email_sends_recipient_sent_at";
    `)

    console.log('[Migration] Performance indexes removed')
}
