/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix Users Email Preferences columns
 *
 * Adds missing email_preferences_* columns and email_unsubscribe_token to users table.
 * Payload groups are stored with underscore prefix.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding email_preferences columns and email_unsubscribe_token to users table...')

    // Add email_preferences_weekly_digest
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_preferences_weekly_digest" boolean DEFAULT true;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add email_preferences_product_alerts
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_preferences_product_alerts" boolean DEFAULT true;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add email_preferences_badge_unlocks
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_preferences_badge_unlocks" boolean DEFAULT true;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add email_preferences_streak_reminders
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_preferences_streak_reminders" boolean DEFAULT true;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add email_preferences_regulatory_updates
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_preferences_regulatory_updates" boolean DEFAULT true;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add email_preferences_community_highlights
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_preferences_community_highlights" boolean DEFAULT false;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add email_unsubscribe_token (text field for one-click unsubscribe)
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "email_unsubscribe_token" varchar;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    console.log('[Migration] Added email_preferences columns and email_unsubscribe_token to users table')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Reverting email_preferences columns is not safe - skipping')
    // Not reverting because dropping columns could lose data
}
