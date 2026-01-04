import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Zero-Input CMS Refactor Migration
 *
 * Products table: Add archetype badges and restricted lab data flag
 * AuditLog table: Add retry capability fields
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // === PRODUCTS TABLE ===

    // Restricted lab data flag (for AVOID products)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "has_restricted_lab_data" boolean DEFAULT false;
    `)

    // Archetype badge fields
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "badges_is_archetype_premium" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "badges_is_archetype_value" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "archetype_calculated_at" timestamp(3) with time zone;
    `)
    await db.execute(sql`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "archetype_override" boolean DEFAULT false;
    `)

    // === AUDIT_LOG TABLE ===

    // Retry capability fields
    await db.execute(sql`
        ALTER TABLE "audit_log"
        ADD COLUMN IF NOT EXISTS "retryable" boolean DEFAULT false;
    `)
    await db.execute(sql`
        ALTER TABLE "audit_log"
        ADD COLUMN IF NOT EXISTS "retry_endpoint" varchar;
    `)
    await db.execute(sql`
        ALTER TABLE "audit_log"
        ADD COLUMN IF NOT EXISTS "retry_payload" jsonb;
    `)
    await db.execute(sql`
        ALTER TABLE "audit_log"
        ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0;
    `)
    await db.execute(sql`
        ALTER TABLE "audit_log"
        ADD COLUMN IF NOT EXISTS "resolved_at" timestamp(3) with time zone;
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    // === PRODUCTS TABLE ===
    await db.execute(sql`
        ALTER TABLE "products"
        DROP COLUMN IF EXISTS "has_restricted_lab_data",
        DROP COLUMN IF EXISTS "badges_is_archetype_premium",
        DROP COLUMN IF EXISTS "badges_is_archetype_value",
        DROP COLUMN IF EXISTS "archetype_calculated_at",
        DROP COLUMN IF EXISTS "archetype_override";
    `)

    // === AUDIT_LOG TABLE ===
    await db.execute(sql`
        ALTER TABLE "audit_log"
        DROP COLUMN IF EXISTS "retryable",
        DROP COLUMN IF EXISTS "retry_endpoint",
        DROP COLUMN IF EXISTS "retry_payload",
        DROP COLUMN IF EXISTS "retry_count",
        DROP COLUMN IF EXISTS "resolved_at";
    `)
}
