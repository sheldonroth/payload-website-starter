/**
 * Database Migration: Legal Framework Enhancements
 *
 * This migration adds:
 * 1. SLA tracking fields to ManufacturerDisputes (slaDeadline, slaBreached, responseTimeHours)
 * 2. Low-confidence gatekeeper fields to detections (matchProbability, displayMode)
 * 3. Fragrance whitelist classification (detectionType)
 *
 * Part of the Legal Framework compliance audit fixes.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding Legal Framework Enhancements...')

    // ═══════════════════════════════════════════════════════════════════════
    // 1. ADD SLA TRACKING FIELDS TO MANUFACTURER_DISPUTES
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "manufacturer_disputes"
        ADD COLUMN IF NOT EXISTS "sla_deadline" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "manufacturer_disputes"
        ADD COLUMN IF NOT EXISTS "sla_breached" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "manufacturer_disputes"
        ADD COLUMN IF NOT EXISTS "response_time_hours" integer;
    `)

    // Add index for SLA deadline tracking
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "manufacturer_disputes_sla_deadline_idx"
        ON "manufacturer_disputes" USING btree ("sla_deadline");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "manufacturer_disputes_sla_breached_idx"
        ON "manufacturer_disputes" USING btree ("sla_breached");
    `)

    console.log('[Migration] ManufacturerDisputes SLA fields added!')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. ADD LOW-CONFIDENCE GATEKEEPER FIELDS TO DETECTIONS
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "match_probability" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "display_mode" varchar DEFAULT 'primary';
    `)

    // ═══════════════════════════════════════════════════════════════════════
    // 3. ADD FRAGRANCE WHITELIST CLASSIFICATION
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "detection_type" varchar DEFAULT 'standard';
    `)

    console.log('[Migration] Detection enhancement fields added!')
    console.log('[Migration] Legal Framework Enhancements complete!')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // Remove SLA tracking fields
    await db.execute(sql`ALTER TABLE "manufacturer_disputes" DROP COLUMN IF EXISTS "sla_deadline";`)
    await db.execute(sql`ALTER TABLE "manufacturer_disputes" DROP COLUMN IF EXISTS "sla_breached";`)
    await db.execute(sql`ALTER TABLE "manufacturer_disputes" DROP COLUMN IF EXISTS "response_time_hours";`)

    // Remove detection enhancement fields
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "match_probability";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "display_mode";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "detection_type";`)

    // Drop indexes
    await db.execute(sql`DROP INDEX IF EXISTS "manufacturer_disputes_sla_deadline_idx";`)
    await db.execute(sql`DROP INDEX IF EXISTS "manufacturer_disputes_sla_breached_idx";`)
}
