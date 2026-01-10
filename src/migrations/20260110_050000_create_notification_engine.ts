/**
 * Database Migration - Create Notification Engine Tables
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create notification_campaigns and notification_sends tables
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating notification engine tables...')

    // Create enum for campaign type (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_campaigns_type') THEN
                CREATE TYPE "public"."enum_notification_campaigns_type" AS ENUM(
                    'scheduled',
                    'triggered',
                    'recurring'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for campaign status (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_campaigns_status') THEN
                CREATE TYPE "public"."enum_notification_campaigns_status" AS ENUM(
                    'draft',
                    'scheduled',
                    'sending',
                    'sent',
                    'paused',
                    'cancelled'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for segment logic (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_campaigns_segment_logic') THEN
                CREATE TYPE "public"."enum_notification_campaigns_segment_logic" AS ENUM(
                    'any',
                    'all'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for recurring frequency (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_campaigns_recurring_frequency') THEN
                CREATE TYPE "public"."enum_notification_campaigns_recurring_frequency" AS ENUM(
                    'daily',
                    'weekly',
                    'biweekly',
                    'monthly'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for trigger events (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_campaigns_trigger_event') THEN
                CREATE TYPE "public"."enum_notification_campaigns_trigger_event" AS ENUM(
                    'product_tested',
                    'badge_unlocked',
                    'streak_milestone',
                    'new_user',
                    'churning_user',
                    'api'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create notification_campaigns table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_campaigns" (
            "id" serial PRIMARY KEY NOT NULL,
            "name" varchar NOT NULL,
            "description" varchar,
            "template_id" integer,
            "type" "enum_notification_campaigns_type" DEFAULT 'scheduled',
            "status" "enum_notification_campaigns_status" DEFAULT 'draft',
            "scheduled_for" timestamp(3) with time zone,
            "recurring_schedule_frequency" "enum_notification_campaigns_recurring_frequency",
            "recurring_schedule_days_of_week" varchar,
            "recurring_schedule_hour" numeric DEFAULT 9,
            "recurring_schedule_minute" numeric DEFAULT 0,
            "recurring_schedule_timezone" varchar DEFAULT 'America/New_York',
            "recurring_schedule_end_date" timestamp(3) with time zone,
            "trigger_config_trigger_event" "enum_notification_campaigns_trigger_event",
            "trigger_config_trigger_delay" numeric DEFAULT 0,
            "targeting_target_all" boolean DEFAULT false,
            "targeting_segment_logic" "enum_notification_campaigns_segment_logic" DEFAULT 'any',
            "targeting_platforms" varchar,
            "rate_limiting_max_per_hour" numeric,
            "rate_limiting_cooldown_hours" numeric DEFAULT 24,
            "rate_limiting_respect_quiet_hours" boolean DEFAULT true,
            "ab_testing_enabled" boolean DEFAULT false,
            "ab_testing_statsig_experiment" varchar,
            "ab_testing_variant_weights" jsonb,
            "sent_count" numeric DEFAULT 0,
            "delivered_count" numeric DEFAULT 0,
            "opened_count" numeric DEFAULT 0,
            "failed_count" numeric DEFAULT 0,
            "last_sent_at" timestamp(3) with time zone,
            "next_scheduled_at" timestamp(3) with time zone,
            "analytics_tag" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Create targeting segments relationship table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_campaigns_targeting_segments" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "user_segments_id" integer NOT NULL
        );
    `)

    // Create exclude segments relationship table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_campaigns_targeting_exclude_segments" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "user_segments_id" integer NOT NULL
        );
    `)

    // Add foreign keys for campaigns
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_campaigns"
            ADD CONSTRAINT "notification_campaigns_template_id_fk"
            FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_campaigns_targeting_segments"
            ADD CONSTRAINT "notification_campaigns_targeting_segments_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "notification_campaigns"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_campaigns_targeting_segments"
            ADD CONSTRAINT "notification_campaigns_targeting_segments_user_segments_id_fk"
            FOREIGN KEY ("user_segments_id") REFERENCES "user_segments"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_campaigns_targeting_exclude_segments"
            ADD CONSTRAINT "notification_campaigns_targeting_exclude_segments_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "notification_campaigns"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_campaigns_targeting_exclude_segments"
            ADD CONSTRAINT "notification_campaigns_targeting_exclude_segments_user_segments_id_fk"
            FOREIGN KEY ("user_segments_id") REFERENCES "user_segments"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create indexes for campaigns
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_campaigns_status_idx" ON "notification_campaigns" USING btree ("status");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_campaigns_type_idx" ON "notification_campaigns" USING btree ("type");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_campaigns_scheduled_for_idx" ON "notification_campaigns" USING btree ("scheduled_for");
    `)

    // Create enum for notification send status (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_sends_status') THEN
                CREATE TYPE "public"."enum_notification_sends_status" AS ENUM(
                    'pending',
                    'sent',
                    'delivered',
                    'opened',
                    'failed',
                    'invalid_token'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for platform (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_sends_platform') THEN
                CREATE TYPE "public"."enum_notification_sends_platform" AS ENUM(
                    'ios',
                    'android'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create notification_sends table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_sends" (
            "id" serial PRIMARY KEY NOT NULL,
            "campaign_id" integer,
            "template_id" integer,
            "push_token_id" integer NOT NULL,
            "fingerprint_hash" varchar,
            "variant" varchar,
            "title" varchar,
            "body" varchar,
            "data" jsonb,
            "status" "enum_notification_sends_status" DEFAULT 'pending',
            "expo_ticket_id" varchar,
            "expo_receipt_status" varchar,
            "error_message" varchar,
            "error_code" varchar,
            "sent_at" timestamp(3) with time zone,
            "delivered_at" timestamp(3) with time zone,
            "opened_at" timestamp(3) with time zone,
            "matched_segments" varchar,
            "platform" "enum_notification_sends_platform",
            "analytics_tag" varchar,
            "statsig_experiment" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Add foreign keys for sends
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_sends"
            ADD CONSTRAINT "notification_sends_campaign_id_fk"
            FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_sends"
            ADD CONSTRAINT "notification_sends_template_id_fk"
            FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_sends"
            ADD CONSTRAINT "notification_sends_push_token_id_fk"
            FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create indexes for sends
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_sends_fingerprint_hash_idx" ON "notification_sends" USING btree ("fingerprint_hash");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_sends_status_idx" ON "notification_sends" USING btree ("status");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_sends_sent_at_idx" ON "notification_sends" USING btree ("sent_at");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_sends_campaign_status_idx" ON "notification_sends" USING btree ("campaign_id", "status");
    `)

    // Add to payload_locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "notification_campaigns_id" integer;
    `)

    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "notification_sends_id" integer;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_notification_campaigns_fk"
            FOREIGN KEY ("notification_campaigns_id") REFERENCES "notification_campaigns"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_notification_sends_fk"
            FOREIGN KEY ("notification_sends_id") REFERENCES "notification_sends"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Notification engine tables created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back notification engine tables...')

    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "notification_campaigns_id";
    `)
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "notification_sends_id";
    `)

    await db.execute(sql`DROP TABLE IF EXISTS "notification_sends" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_campaigns_targeting_exclude_segments" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_campaigns_targeting_segments" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_campaigns" CASCADE;`)

    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_sends_platform";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_sends_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_campaigns_trigger_event";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_campaigns_recurring_frequency";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_campaigns_segment_logic";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_campaigns_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_campaigns_type";`)

    console.log('[Migration] Notification engine rollback completed')
}
