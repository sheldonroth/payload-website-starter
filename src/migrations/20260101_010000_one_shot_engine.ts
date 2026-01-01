import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * One-Shot Engine Migration
 *
 * Creates tables for the freemium unlock system:
 * - device_fingerprints: Track unique devices via FingerprintJS
 * - product_unlocks: Immutable record of all product unlocks
 * - Users field additions: memberState, totalUnlocks, lastUnlockAt
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating One-Shot Engine tables...')

    // ============================================
    // ENUM TYPES
    // ============================================

    // DeviceFingerprints device type enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_device_fingerprints_device_type" AS ENUM('desktop', 'mobile', 'tablet');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // ProductUnlocks unlock type enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_product_unlocks_unlock_type" AS ENUM('free_credit', 'subscription', 'admin_grant');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // ProductUnlocks archetype shown enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_product_unlocks_archetype_shown" AS ENUM('best_value', 'premium_pick', 'hidden_gem');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Users member state enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_users_member_state" AS ENUM('virgin', 'trial', 'member');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Created enum types')

    // ============================================
    // DEVICE FINGERPRINTS TABLE
    // ============================================
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "device_fingerprints" (
            "id" serial PRIMARY KEY NOT NULL,
            "fingerprint_hash" varchar NOT NULL UNIQUE,
            "user_id" integer,
            "browser" varchar,
            "os" varchar,
            "device_type" "enum_device_fingerprints_device_type",
            "first_seen_at" timestamp(3) with time zone NOT NULL,
            "last_seen_at" timestamp(3) with time zone,
            "unlock_credits_used" numeric DEFAULT 0,
            "ip_country" varchar,
            "is_banned" boolean DEFAULT false,
            "ban_reason" varchar,
            "suspicious_activity" boolean DEFAULT false,
            "emails_used" jsonb,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created device_fingerprints table')

    // Add foreign key to users
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "device_fingerprints" ADD CONSTRAINT "device_fingerprints_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Indexes for device_fingerprints
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "device_fingerprints_fingerprint_hash_idx" ON "device_fingerprints" USING btree ("fingerprint_hash");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "device_fingerprints_user_id_idx" ON "device_fingerprints" USING btree ("user_id");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "device_fingerprints_created_at_idx" ON "device_fingerprints" USING btree ("created_at");`)

    // ============================================
    // PRODUCT UNLOCKS TABLE
    // ============================================
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "product_unlocks" (
            "id" serial PRIMARY KEY NOT NULL,
            "user_id" integer,
            "device_fingerprint_id" integer,
            "email" varchar,
            "product_id" integer NOT NULL,
            "unlock_type" "enum_product_unlocks_unlock_type" NOT NULL,
            "archetype_shown" "enum_product_unlocks_archetype_shown",
            "unlocked_at" timestamp(3) with time zone NOT NULL,
            "source_product_id" numeric,
            "session_id" varchar,
            "referral_source" varchar,
            "converted_to_subscription" boolean DEFAULT false,
            "conversion_date" timestamp(3) with time zone,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created product_unlocks table')

    // Add foreign keys
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "product_unlocks" ADD CONSTRAINT "product_unlocks_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "product_unlocks" ADD CONSTRAINT "product_unlocks_device_fingerprint_id_fk"
            FOREIGN KEY ("device_fingerprint_id") REFERENCES "device_fingerprints"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "product_unlocks" ADD CONSTRAINT "product_unlocks_product_id_products_id_fk"
            FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Indexes for product_unlocks
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_unlocks_user_id_idx" ON "product_unlocks" USING btree ("user_id");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_unlocks_device_fingerprint_id_idx" ON "product_unlocks" USING btree ("device_fingerprint_id");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_unlocks_product_id_idx" ON "product_unlocks" USING btree ("product_id");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_unlocks_unlocked_at_idx" ON "product_unlocks" USING btree ("unlocked_at");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_unlocks_created_at_idx" ON "product_unlocks" USING btree ("created_at");`)

    // ============================================
    // USERS TABLE ADDITIONS
    // ============================================

    // Add memberState field
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "member_state" "enum_users_member_state" DEFAULT 'virgin';
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)

    // Add totalUnlocks field
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "total_unlocks" numeric DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)

    // Add lastUnlockAt field
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users" ADD COLUMN "last_unlock_at" timestamp(3) with time zone;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)

    console.log('[Migration] Added memberState, totalUnlocks, lastUnlockAt to users table')

    // ============================================
    // USERS_RELS TABLE (for deviceFingerprints hasMany relationship)
    // ============================================
    // Check if we need to add columns for device_fingerprints relationship
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users_rels" ADD COLUMN "device_fingerprints_id" integer;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_device_fingerprints_fk"
            FOREIGN KEY ("device_fingerprints_id") REFERENCES "device_fingerprints"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_rels_device_fingerprints_id_idx" ON "users_rels" USING btree ("device_fingerprints_id");`)

    console.log('[Migration] Added deviceFingerprints relationship to users_rels')
    console.log('[Migration] One-Shot Engine tables created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Dropping One-Shot Engine tables...')

    // Remove columns from users_rels
    await db.execute(sql`ALTER TABLE "users_rels" DROP COLUMN IF EXISTS "device_fingerprints_id";`)

    // Remove columns from users
    await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "member_state";`)
    await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "total_unlocks";`)
    await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "last_unlock_at";`)

    // Drop tables
    await db.execute(sql`DROP TABLE IF EXISTS "product_unlocks" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "device_fingerprints" CASCADE;`)

    // Drop enum types
    await db.execute(sql`DROP TYPE IF EXISTS "enum_users_member_state";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_product_unlocks_archetype_shown";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_product_unlocks_unlock_type";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_device_fingerprints_device_type";`)

    console.log('[Migration] One-Shot Engine tables dropped')
}
