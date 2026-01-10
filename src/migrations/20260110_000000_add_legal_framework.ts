/**
 * Database Migration: Legal Protection Framework
 *
 * This migration adds:
 * 1. ManufacturerDisputes collection for Right of Reply system
 * 2. Legal defense fields to Products (detectionResults, sampleInfo, manufacturerResponse)
 *
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding Legal Protection Framework tables and columns...')

    // ═══════════════════════════════════════════════════════════════════════
    // 1. CREATE MANUFACTURER_DISPUTES TABLE
    // ═══════════════════════════════════════════════════════════════════════
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "manufacturer_disputes" (
            "id" serial PRIMARY KEY,
            "reference_number" varchar UNIQUE NOT NULL,
            "status" varchar DEFAULT 'pending',
            "priority" varchar DEFAULT 'normal',
            "company_name" varchar NOT NULL,
            "contact_name" varchar NOT NULL,
            "contact_email" varchar NOT NULL,
            "contact_phone" varchar NOT NULL,
            "contact_title" varchar,
            "email_domain_verified" boolean DEFAULT false,
            "product_id" integer,
            "product_reference" varchar,
            "sample_id" varchar,
            "dispute_type" varchar NOT NULL,
            "description" text NOT NULL,
            "assigned_to_id" integer,
            "internal_notes" jsonb,
            "investigation_findings" jsonb,
            "lab_review_requested" boolean DEFAULT false,
            "lab_review_date" timestamp(3) with time zone,
            "report_updated" boolean DEFAULT false,
            "update_description" text,
            "response_to_manufacturer" jsonb,
            "response_date" timestamp(3) with time zone,
            "response_sent_by_id" integer,
            "manufacturer_follow_up" jsonb,
            "resolution_summary" text,
            "resolved_date" timestamp(3) with time zone,
            "submitted_at" timestamp(3) with time zone DEFAULT now(),
            "ip_address" varchar,
            "user_agent" text,
            "verification_checkbox" boolean DEFAULT false,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Create supporting documents array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "manufacturer_disputes_supporting_documents" (
            "id" serial PRIMARY KEY,
            "_parent_id" integer NOT NULL REFERENCES "manufacturer_disputes"("id") ON DELETE CASCADE,
            "_order" integer NOT NULL,
            "document_id" integer,
            "document_description" varchar
        );
    `)

    // Create audit log array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "manufacturer_disputes_audit_log" (
            "id" serial PRIMARY KEY,
            "_parent_id" integer NOT NULL REFERENCES "manufacturer_disputes"("id") ON DELETE CASCADE,
            "_order" integer NOT NULL,
            "timestamp" timestamp(3) with time zone,
            "action" varchar,
            "performed_by_id" integer,
            "notes" text
        );
    `)

    // Add indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "manufacturer_disputes_reference_number_idx"
        ON "manufacturer_disputes" USING btree ("reference_number");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "manufacturer_disputes_status_idx"
        ON "manufacturer_disputes" USING btree ("status");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "manufacturer_disputes_created_at_idx"
        ON "manufacturer_disputes" USING btree ("created_at");
    `)

    console.log('[Migration] ManufacturerDisputes table created!')

    // ═══════════════════════════════════════════════════════════════════════
    // 2. ADD LEGAL DEFENSE FIELDS TO PRODUCTS
    // ═══════════════════════════════════════════════════════════════════════

    // Detection Results group (Weather Report Doctrine)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "detection_results_spectrograph_image_url" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "detection_results_spectrograph_image_id" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "detection_results_raw_data_available" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "detection_results_lab_name" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "detection_results_test_date" timestamp(3) with time zone;
    `)

    // Sample Info group (Chain of Custody)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_sample_id" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_purchase_date" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_purchase_retailer" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_lot_number" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_expiration_date" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_photo_of_purchase_id" integer;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sample_info_photo_of_product_id" integer;
    `)

    // Manufacturer Response group (Right of Reply)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_dispute_received" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_dispute_date" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_dispute_reference" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_dispute_summary" text;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_our_response" text;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_data_updated" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_update_date" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer_response_update_description" text;
    `)

    // Create detections array table for products
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "products_detection_results_detections" (
            "id" serial PRIMARY KEY,
            "_parent_id" integer NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
            "_order" integer NOT NULL,
            "compound" varchar NOT NULL,
            "level" varchar,
            "threshold" varchar,
            "interpretation" varchar
        );
    `)

    console.log('[Migration] Products legal defense fields added!')
    console.log('[Migration] Legal Protection Framework migration complete!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    // Drop products detections array table
    await db.execute(sql`DROP TABLE IF EXISTS "products_detection_results_detections";`)

    // Drop manufacturer_disputes related tables
    await db.execute(sql`DROP TABLE IF EXISTS "manufacturer_disputes_audit_log";`)
    await db.execute(sql`DROP TABLE IF EXISTS "manufacturer_disputes_supporting_documents";`)
    await db.execute(sql`DROP TABLE IF EXISTS "manufacturer_disputes";`)

    // Remove Products legal columns
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "detection_results_spectrograph_image_url";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "detection_results_spectrograph_image_id";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "detection_results_raw_data_available";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "detection_results_lab_name";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "detection_results_test_date";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_sample_id";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_purchase_date";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_purchase_retailer";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_lot_number";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_expiration_date";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_photo_of_purchase_id";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "sample_info_photo_of_product_id";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_dispute_received";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_dispute_date";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_dispute_reference";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_dispute_summary";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_our_response";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_data_updated";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_update_date";`)
    await db.execute(sql`ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer_response_update_description";`)
}
