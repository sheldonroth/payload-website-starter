/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create Notification Templates Collection
 *
 * Creates tables for managing push notification content with A/B testing support.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating notification_templates tables...')

    // Create type enum (check existence first to avoid constraint violations)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_templates_type') THEN
                CREATE TYPE "public"."enum_notification_templates_type" AS ENUM(
                    'daily_discovery',
                    'streak_reminder',
                    'badge_unlock',
                    'product_ready',
                    'weekly_digest',
                    'milestone',
                    'promotional',
                    're_engagement',
                    'feature_announcement'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create schedule timezone enum (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notification_templates_schedule_timezone') THEN
                CREATE TYPE "public"."enum_notification_templates_schedule_timezone" AS ENUM(
                    'user_local',
                    'UTC',
                    'America/New_York',
                    'America/Los_Angeles',
                    'America/Chicago'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create main notification_templates table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_templates" (
            "id" serial PRIMARY KEY NOT NULL,
            "name" varchar NOT NULL,
            "type" "enum_notification_templates_type" NOT NULL,
            "description" varchar,
            "is_active" boolean DEFAULT true,
            "experiment_name" varchar,
            "schedule_enabled" boolean DEFAULT true,
            "schedule_hour" numeric,
            "schedule_minute" numeric DEFAULT 0,
            "schedule_timezone" "enum_notification_templates_schedule_timezone" DEFAULT 'user_local',
            "schedule_repeats" boolean DEFAULT true,
            "schedule_cooldown_hours" numeric DEFAULT 24,
            "targeting_min_days_since_install" numeric,
            "targeting_max_days_since_install" numeric,
            "targeting_min_scans" numeric,
            "targeting_max_scans" numeric,
            "targeting_min_streak_days" numeric,
            "targeting_requires_streak" boolean DEFAULT false,
            "targeting_requires_subscription" boolean DEFAULT false,
            "targeting_exclude_subscribers" boolean DEFAULT false,
            "analytics_tracking_id" varchar,
            "analytics_category" varchar,
            "version" numeric DEFAULT 1,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created notification_templates table')

    // Create variants array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_templates_variants" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "variant_id" varchar NOT NULL,
            "title" varchar NOT NULL,
            "body" varchar NOT NULL,
            "emoji" varchar,
            "weight" numeric DEFAULT 1,
            "action" varchar,
            "action_data" jsonb
        );
    `)
    console.log('[Migration] Created notification_templates_variants table')

    // Add foreign key from variants to parent
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_templates_variants"
            ADD CONSTRAINT "notification_templates_variants_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "notification_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create schedule_days_of_week junction table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_templates_schedule_days_of_week" (
            "order" integer NOT NULL,
            "parent_id" integer NOT NULL,
            "value" varchar,
            "id" serial PRIMARY KEY NOT NULL
        );
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_templates_schedule_days_of_week"
            ADD CONSTRAINT "notification_templates_schedule_days_of_week_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "notification_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create targeting_segments junction table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_templates_targeting_segments" (
            "order" integer NOT NULL,
            "parent_id" integer NOT NULL,
            "value" varchar,
            "id" serial PRIMARY KEY NOT NULL
        );
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_templates_targeting_segments"
            ADD CONSTRAINT "notification_templates_targeting_segments_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "notification_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create targeting_platforms junction table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_templates_targeting_platforms" (
            "order" integer NOT NULL,
            "parent_id" integer NOT NULL,
            "value" varchar,
            "id" serial PRIMARY KEY NOT NULL
        );
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "notification_templates_targeting_platforms"
            ADD CONSTRAINT "notification_templates_targeting_platforms_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "notification_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_templates_type_idx"
        ON "notification_templates" USING btree ("type");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_templates_is_active_idx"
        ON "notification_templates" USING btree ("is_active");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "notification_templates_variants_order_parent_idx"
        ON "notification_templates_variants" USING btree ("_order", "_parent_id");
    `)
    console.log('[Migration] Created notification_templates indexes')

    // Add to locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "notification_templates_id" integer;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_notification_templates_fk"
            FOREIGN KEY ("notification_templates_id") REFERENCES "notification_templates"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Notification templates migration completed!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back notification_templates...')

    await db.execute(sql`DROP TABLE IF EXISTS "notification_templates_targeting_platforms" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_templates_targeting_segments" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_templates_schedule_days_of_week" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_templates_variants" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "notification_templates" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_templates_schedule_timezone";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_notification_templates_type";`)

    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "notification_templates_id";
    `)

    console.log('[Migration] Notification templates rollback completed')
}
