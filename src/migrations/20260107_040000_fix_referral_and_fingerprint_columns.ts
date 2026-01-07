import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix Referral Payouts and Device Fingerprints columns
 *
 * Adds missing columns that Payload expects but don't exist in the database.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding missing columns to referral_payouts and device_fingerprints...')

    // ======= REFERRAL_PAYOUTS TABLE =======
    // Add missing columns to referral_payouts
    // Has: id, referrer_visitor_id, amount, period, status, processed_at, created_at
    // Needs: referrer_id, referrer_email, referral_count, payment_method, payment_details, transaction_id, w9_collected, ytd_total, notes, updated_at

    // Rename referrer_visitor_id to referrer_id if it exists
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" RENAME COLUMN "referrer_visitor_id" TO "referrer_id";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    // Add referrer_email
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "referrer_email" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add referral_count
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "referral_count" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add payment_method
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "payment_method" varchar DEFAULT 'paypal';
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add payment_details
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "payment_details" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add transaction_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "transaction_id" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add w9_collected
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "w9_collected" boolean DEFAULT false;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add ytd_total
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "ytd_total" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add notes
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "notes" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add updated_at
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts" ADD COLUMN "updated_at" timestamp(3) with time zone DEFAULT now();
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    console.log('[Migration] Fixed referral_payouts columns')

    // ======= DEVICE_FINGERPRINTS TABLE =======
    // Has: id, fingerprint_hash, user_id, browser, os, device_type, first_seen_at, last_seen_at, unlock_credits_used, ip_country, is_banned, ban_reason, suspicious_activity, emails_used, updated_at, created_at, suspicious_score
    // Needs: total_unlocks, referral_code, referred_by, total_referrals, active_referrals, pending_referrals, total_commission_earned, payout_email, behavior_metrics_*

    // Add total_unlocks
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "total_unlocks" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add referral_code
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "referral_code" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add referred_by
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "referred_by" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add total_referrals
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "total_referrals" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add active_referrals
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "active_referrals" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add pending_referrals
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "pending_referrals" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add total_commission_earned
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "total_commission_earned" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add payout_email
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "payout_email" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add behavior_metrics group fields (Payload flattens groups with underscore prefix)
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_total_scans" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_avoid_hits" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_session_count" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_search_count" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_vote_count" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_cohort" varchar DEFAULT 'experiment';
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_paywalls_shown" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD COLUMN "behavior_metrics_paywalls_dismissed" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add unique index for referral_code
    await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS "device_fingerprints_referral_code_idx"
        ON "device_fingerprints" ("referral_code")
        WHERE "referral_code" IS NOT NULL;
    `)

    console.log('[Migration] Fixed device_fingerprints columns')
    console.log('[Migration] All column fixes complete')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Reverting column additions is not safe - skipping')
    // Not reverting because dropping columns could lose data
}
