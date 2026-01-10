/**
 * Database Migration - Create Paywall Variants Collection
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create paywall_variants table for A/B testing subscription screens
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating paywall_variants table...')

    // Create enum for trial emphasis (with race condition protection)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_paywall_variants_trial_emphasis') THEN
                CREATE TYPE "public"."enum_paywall_variants_trial_emphasis" AS ENUM(
                    'prominent',
                    'subtle',
                    'in_cta',
                    'hidden'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create main paywall_variants table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "paywall_variants" (
            "id" serial PRIMARY KEY NOT NULL,
            "variant_id" varchar NOT NULL UNIQUE,
            "name" varchar NOT NULL,
            "description" varchar,
            "headline" varchar NOT NULL,
            "subheadline" varchar,
            "cta_text" varchar NOT NULL DEFAULT 'Start Free Trial',
            "cta_subtext" varchar,
            "trial_emphasis" "enum_paywall_variants_trial_emphasis" DEFAULT 'prominent',
            "show_social_proof" boolean DEFAULT true,
            "social_proof_text" varchar,
            "social_proof_rating" varchar,
            "background_color" varchar,
            "accent_color" varchar,
            "hero_image_id" integer,
            "is_active" boolean DEFAULT true,
            "weight" numeric DEFAULT 1,
            "analytics_tag" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Add foreign key to media
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "paywall_variants"
            ADD CONSTRAINT "paywall_variants_hero_image_id_media_id_fk"
            FOREIGN KEY ("hero_image_id") REFERENCES "media"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create value_props array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "paywall_variants_value_props" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "text" varchar NOT NULL,
            "icon" varchar,
            "emoji" varchar,
            "lottie_key" varchar
        );
    `)

    // Add foreign key for value_props
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "paywall_variants_value_props"
            ADD CONSTRAINT "paywall_variants_value_props_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "paywall_variants"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "paywall_variants_is_active_idx" ON "paywall_variants" USING btree ("is_active");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "paywall_variants_variant_id_idx" ON "paywall_variants" USING btree ("variant_id");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "paywall_variants_value_props_order_idx" ON "paywall_variants_value_props" USING btree ("_order", "_parent_id");
    `)

    // Add to payload_locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "paywall_variants_id" integer;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_paywall_variants_fk"
            FOREIGN KEY ("paywall_variants_id") REFERENCES "paywall_variants"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Paywall variants table created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back paywall_variants...')

    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "paywall_variants_id";
    `)

    await db.execute(sql`DROP TABLE IF EXISTS "paywall_variants_value_props" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "paywall_variants" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_paywall_variants_trial_emphasis";`)

    console.log('[Migration] Paywall variants rollback completed')
}
