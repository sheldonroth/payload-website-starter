import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Performance Indexes Migration
 *
 * Adds database indexes for frequently queried columns to optimize
 * query performance on the Neon PostgreSQL database.
 * 
 * NOTE: All index creations check for table existence first to prevent
 * failures on environments where tables haven't been created yet.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding performance indexes (with table existence checks)...')

    // Helper to check if table exists and create index
    async function createIndexIfTableExists(tableName: string, indexSql: string, indexName: string) {
        try {
            await db.execute(sql.raw(`
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') THEN
                        EXECUTE '${indexSql}';
                    ELSE
                        RAISE NOTICE 'Table ${tableName} does not exist, skipping index ${indexName}';
                    END IF;
                END $$;
            `))
            console.log(`[Migration] Processed index ${indexName}`)
        } catch (error) {
            console.log(`[Migration] Skipping ${indexName}: table or column may not exist`)
        }
    }

    // 1. contributor_profiles indexes
    await createIndexIfTableExists(
        'contributor_profiles',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_contributor_profiles_shareable_slug ON contributor_profiles (shareable_slug) WHERE shareable_slug IS NOT NULL',
        'idx_contributor_profiles_shareable_slug'
    )

    await createIndexIfTableExists(
        'contributor_profiles',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_contributor_profiles_fingerprint_hash ON contributor_profiles (fingerprint_hash) WHERE fingerprint_hash IS NOT NULL',
        'idx_contributor_profiles_fingerprint_hash'
    )

    await createIndexIfTableExists(
        'contributor_profiles',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_contributor_profiles_contributor_number ON contributor_profiles (contributor_number) WHERE contributor_number IS NOT NULL',
        'idx_contributor_profiles_contributor_number'
    )

    // 2. products indexes
    await createIndexIfTableExists(
        'products',
        'CREATE INDEX IF NOT EXISTS idx_products_brand_category ON products (brand, category_id)',
        'idx_products_brand_category'
    )

    // 3. brand_analytics indexes
    await createIndexIfTableExists(
        'brand_analytics',
        'CREATE INDEX IF NOT EXISTS idx_brand_analytics_brand_date ON brand_analytics (brand_id, date DESC)',
        'idx_brand_analytics_brand_date'
    )

    // 4. device_fingerprints indexes
    await createIndexIfTableExists(
        'device_fingerprints',
        'CREATE INDEX IF NOT EXISTS idx_device_fingerprints_suspicious_score ON device_fingerprints (suspicious_score DESC) WHERE suspicious_score > 0',
        'idx_device_fingerprints_suspicious_score'
    )

    // 5. videos indexes
    await createIndexIfTableExists(
        'videos',
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_youtube_video_id ON videos (youtube_video_id) WHERE youtube_video_id IS NOT NULL',
        'idx_videos_youtube_video_id'
    )

    // 6. product_votes indexes
    await createIndexIfTableExists(
        'product_votes',
        'CREATE INDEX IF NOT EXISTS idx_product_votes_barcode ON product_votes (barcode)',
        'idx_product_votes_barcode'
    )

    // 7. referrals indexes
    await createIndexIfTableExists(
        'referrals',
        'CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals (referrer_id)',
        'idx_referrals_referrer_id'
    )

    // 8. email_sends indexes
    await createIndexIfTableExists(
        'email_sends',
        'CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_template ON email_sends (recipient, template)',
        'idx_email_sends_recipient_template'
    )

    await createIndexIfTableExists(
        'email_sends',
        'CREATE INDEX IF NOT EXISTS idx_email_sends_recipient_sent_at ON email_sends (recipient, sent_at DESC)',
        'idx_email_sends_recipient_sent_at'
    )

    console.log('[Migration] Performance indexes processed!')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Removing performance indexes...')

    // Drop all indexes created by this migration (IF EXISTS handles missing tables)
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
