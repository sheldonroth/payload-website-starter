/**
 * Database Migration: Daubert Defense Scientific Validation Fields
 *
 * This migration adds:
 * 1. Detection confirmation level (screening/confirmed/quantified) to detections
 * 2. Reference Standard documentation fields for each detection
 * 3. Calibration Data fields for quantified detections
 * 4. Evidence Locker fields for chain of custody documentation
 *
 * Part of the Legal Defense Framework - enables blocking AVOID verdicts
 * without proper scientific documentation to survive Daubert challenges.
 *
 * See docs/DAUBERT_DEFENSE_PLAYBOOK.md for implementation guidance.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding Daubert Defense Scientific Validation Fields...')

    // ═══════════════════════════════════════════════════════════════════════
    // 1. DETECTION CONFIRMATION LEVEL
    // Critical field for legal defensibility - screening cannot support AVOID
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "confirmation_level" varchar DEFAULT 'screening';
    `)
    console.log('[Migration] Added confirmation_level to detections')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. REFERENCE STANDARD DOCUMENTATION (nested in detections)
    // Required for confirmed/quantified detections
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_standard_name" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_catalog_number" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_lot_number" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_expiration_date" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_certificate_of_analysis_id" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_retention_time_match" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "reference_standard_spectrum_match" boolean DEFAULT false;
    `)
    console.log('[Migration] Added reference_standard fields to detections')

    // ═══════════════════════════════════════════════════════════════════════
    // 3. CALIBRATION DATA (nested in detections)
    // Required for quantified detections
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "calibration_data_calibration_date" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "calibration_data_calibration_levels" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "calibration_data_r_squared" numeric;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "calibration_data_limit_of_detection" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "calibration_data_limit_of_quantification" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products_detection_results_detections"
        ADD COLUMN IF NOT EXISTS "calibration_data_calibration_curve_id" integer;
    `)
    console.log('[Migration] Added calibration_data fields to detections')

    // ═══════════════════════════════════════════════════════════════════════
    // 4. EVIDENCE LOCKER (on products table)
    // Secure storage for unboxing videos and raw lab reports
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "evidence_locker_unboxing_video_id" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "evidence_locker_lab_report_original_id" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "evidence_locker_lab_report_hash" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "evidence_locker_lab_chain_of_custody_id" integer;
    `)
    console.log('[Migration] Added evidence_locker fields to products')

    // ═══════════════════════════════════════════════════════════════════════
    // 5. ADD FOREIGN KEY CONSTRAINTS FOR MEDIA REFERENCES
    // ═══════════════════════════════════════════════════════════════════════
    // FK for reference standard certificate of analysis
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'products_detections_ref_std_coa_fk'
            ) THEN
                ALTER TABLE "products_detection_results_detections"
                ADD CONSTRAINT "products_detections_ref_std_coa_fk"
                FOREIGN KEY ("reference_standard_certificate_of_analysis_id")
                REFERENCES "media"("id") ON DELETE SET NULL;
            END IF;
        END $$;
    `)

    // FK for calibration curve
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'products_detections_cal_curve_fk'
            ) THEN
                ALTER TABLE "products_detection_results_detections"
                ADD CONSTRAINT "products_detections_cal_curve_fk"
                FOREIGN KEY ("calibration_data_calibration_curve_id")
                REFERENCES "media"("id") ON DELETE SET NULL;
            END IF;
        END $$;
    `)

    // FK for evidence locker - unboxing video
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'products_evidence_unboxing_fk'
            ) THEN
                ALTER TABLE "products"
                ADD CONSTRAINT "products_evidence_unboxing_fk"
                FOREIGN KEY ("evidence_locker_unboxing_video_id")
                REFERENCES "media"("id") ON DELETE SET NULL;
            END IF;
        END $$;
    `)

    // FK for evidence locker - lab report original
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'products_evidence_lab_report_fk'
            ) THEN
                ALTER TABLE "products"
                ADD CONSTRAINT "products_evidence_lab_report_fk"
                FOREIGN KEY ("evidence_locker_lab_report_original_id")
                REFERENCES "media"("id") ON DELETE SET NULL;
            END IF;
        END $$;
    `)

    // FK for evidence locker - chain of custody doc
    await db.execute(sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'products_evidence_coc_fk'
            ) THEN
                ALTER TABLE "products"
                ADD CONSTRAINT "products_evidence_coc_fk"
                FOREIGN KEY ("evidence_locker_lab_chain_of_custody_id")
                REFERENCES "media"("id") ON DELETE SET NULL;
            END IF;
        END $$;
    `)

    console.log('[Migration] Added foreign key constraints')
    console.log('[Migration] Daubert Defense Scientific Validation Fields complete!')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Removing Daubert Defense fields...')

    // Drop foreign keys first
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP CONSTRAINT IF EXISTS "products_detections_ref_std_coa_fk";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP CONSTRAINT IF EXISTS "products_detections_cal_curve_fk";`)
    await db.execute(sql`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_evidence_unboxing_fk";`)
    await db.execute(sql`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_evidence_lab_report_fk";`)
    await db.execute(sql`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_evidence_coc_fk";`)

    // Detection confirmation level
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "confirmation_level";`)

    // Reference Standard fields
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_standard_name";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_catalog_number";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_lot_number";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_expiration_date";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_certificate_of_analysis_id";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_retention_time_match";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "reference_standard_spectrum_match";`)

    // Calibration Data fields
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "calibration_data_calibration_date";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "calibration_data_calibration_levels";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "calibration_data_r_squared";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "calibration_data_limit_of_detection";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "calibration_data_limit_of_quantification";`)
    await db.execute(sql`ALTER TABLE "products_detection_results_detections" DROP COLUMN IF EXISTS "calibration_data_calibration_curve_id";`)

    // Evidence Locker fields
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "evidence_locker_unboxing_video_id";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "evidence_locker_lab_report_original_id";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "evidence_locker_lab_report_hash";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "evidence_locker_lab_chain_of_custody_id";`)

    console.log('[Migration] Daubert Defense fields removed!')
}
