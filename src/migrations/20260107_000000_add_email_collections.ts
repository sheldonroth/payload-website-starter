/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Email Collections
 *
 * Creates tables for EmailTemplates and EmailSends collections
 * that were defined but never migrated.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating email collections tables...')

    // ============================================
    // CREATE EMAIL_TEMPLATES TABLE
    // ============================================

    // Create sequence enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_email_templates_sequence" AS ENUM(
                'week1_value',
                'weekly_digest',
                'winback',
                'fomo_trigger',
                'year_in_clean',
                'badge_unlock',
                'product_update'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create trigger_event enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_email_templates_trigger_event" AS ENUM(
                'product_retested',
                'brand_news',
                'new_category_tests',
                'badge_unlocked',
                'year_in_clean_ready'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create status enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_email_templates_status" AS ENUM(
                'draft',
                'active',
                'paused'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create email_templates table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "email_templates" (
            "id" serial PRIMARY KEY NOT NULL,
            "sequence" "enum_email_templates_sequence" NOT NULL,
            "day_in_sequence" numeric,
            "trigger_event" "enum_email_templates_trigger_event",
            "subject" varchar NOT NULL,
            "subject_variant_b" varchar,
            "preheader" varchar,
            "headline" varchar,
            "body" jsonb,
            "cta_text" varchar,
            "cta_url" varchar,
            "personalization_available_variables" jsonb DEFAULT '[]',
            "status" "enum_email_templates_status" DEFAULT 'draft',
            "stats_sent" numeric DEFAULT 0,
            "stats_opened" numeric DEFAULT 0,
            "stats_clicked" numeric DEFAULT 0,
            "stats_open_rate" varchar,
            "stats_click_rate" varchar,
            "internal_notes" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created email_templates table')

    // Create personalization array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "email_templates_personalization_available_variables" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "variable" varchar,
            "description" varchar
        );
    `)

    // Add foreign key for personalization array
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "email_templates_personalization_available_variables"
            ADD CONSTRAINT "email_templates_personalization_available_variables_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "email_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add indexes for email_templates
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "email_templates_sequence_idx"
        ON "email_templates" USING btree ("sequence");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "email_templates_status_idx"
        ON "email_templates" USING btree ("status");
    `)
    console.log('[Migration] Created email_templates indexes')

    // ============================================
    // CREATE EMAIL_SENDS TABLE
    // ============================================

    // Create ab_variant enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_email_sends_ab_variant" AS ENUM(
                'A',
                'B'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create status enum
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_email_sends_status" AS ENUM(
                'sent',
                'delivered',
                'opened',
                'clicked',
                'bounced',
                'complained'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create email_sends table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "email_sends" (
            "id" serial PRIMARY KEY NOT NULL,
            "template" integer NOT NULL,
            "recipient" varchar NOT NULL,
            "subject" varchar NOT NULL,
            "ab_variant" "enum_email_sends_ab_variant" DEFAULT 'A',
            "message_id" varchar,
            "sent_at" timestamp(3) with time zone NOT NULL,
            "status" "enum_email_sends_status" DEFAULT 'sent',
            "opened_at" timestamp(3) with time zone,
            "clicked_at" timestamp(3) with time zone,
            "clicked_url" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created email_sends table')

    // Add foreign key from email_sends to email_templates
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "email_sends"
            ADD CONSTRAINT "email_sends_template_fk"
            FOREIGN KEY ("template") REFERENCES "email_templates"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add indexes for email_sends
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "email_sends_recipient_idx"
        ON "email_sends" USING btree ("recipient");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "email_sends_message_id_idx"
        ON "email_sends" USING btree ("message_id");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "email_sends_status_idx"
        ON "email_sends" USING btree ("status");
    `)
    console.log('[Migration] Created email_sends indexes')

    // ============================================
    // ADD LOCKED DOCS RELS COLUMNS FOR EMAILS
    // ============================================
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents__rels"
        ADD COLUMN IF NOT EXISTS "email_templates_id" integer,
        ADD COLUMN IF NOT EXISTS "email_sends_id" integer;
    `)

    // Add foreign keys
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents__rels"
            ADD CONSTRAINT "payload_locked_documents__rels_email_templates_fk"
            FOREIGN KEY ("email_templates_id") REFERENCES "email_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents__rels"
            ADD CONSTRAINT "payload_locked_documents__rels_email_sends_fk"
            FOREIGN KEY ("email_sends_id") REFERENCES "email_sends"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Email collections migration completed!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back email collections...')

    // Drop email_sends table
    await db.execute(sql`DROP TABLE IF EXISTS "email_sends" CASCADE;`)

    // Drop email_templates tables
    await db.execute(sql`DROP TABLE IF EXISTS "email_templates_personalization_available_variables" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "email_templates" CASCADE;`)

    // Drop enums
    await db.execute(sql`DROP TYPE IF EXISTS "enum_email_sends_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_email_sends_ab_variant";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_email_templates_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_email_templates_trigger_event";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_email_templates_sequence";`)

    console.log('[Migration] Email collections rollback completed')
}
