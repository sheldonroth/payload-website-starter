/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Referral Breakdown Table
 *
 * Creates the missing referral_payouts_referral_breakdown table for the array field.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating referral_payouts_referral_breakdown table...')

    // Create the array table for referralBreakdown
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "referral_payouts_referral_breakdown" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "referral_id" varchar NOT NULL,
            "referred_email" varchar,
            "amount" numeric NOT NULL,
            "anniversary_date" timestamp(3) with time zone
        );
    `)

    // Add foreign key constraint
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "referral_payouts_referral_breakdown"
            ADD CONSTRAINT "referral_payouts_referral_breakdown_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "referral_payouts"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add index on _parent_id for faster lookups
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referral_payouts_referral_breakdown_parent_id_idx"
        ON "referral_payouts_referral_breakdown" ("_parent_id");
    `)

    // Add index on _order for proper ordering
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "referral_payouts_referral_breakdown_order_idx"
        ON "referral_payouts_referral_breakdown" ("_order");
    `)

    console.log('[Migration] Created referral_payouts_referral_breakdown table')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Dropping referral_payouts_referral_breakdown table...')

    await db.execute(sql`
        DROP TABLE IF EXISTS "referral_payouts_referral_breakdown" CASCADE;
    `)

    console.log('[Migration] Dropped referral_payouts_referral_breakdown table')
}
