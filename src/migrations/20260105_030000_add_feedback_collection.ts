/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add Feedback collection
 *
 * Creates the feedback table for storing user feedback from the mobile app.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Create enum for platform
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_feedback_platform" AS ENUM ('ios', 'android', 'web');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create enum for status
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_feedback_status" AS ENUM ('new', 'reviewed', 'actioned', 'archived');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create feedback table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "feedback" (
            "id" serial PRIMARY KEY NOT NULL,
            "message" varchar NOT NULL,
            "email" varchar,
            "user_id" integer,
            "platform" "enum_feedback_platform" DEFAULT 'ios' NOT NULL,
            "source" varchar DEFAULT 'mobile-app',
            "status" "enum_feedback_status" DEFAULT 'new',
            "admin_notes" varchar,
            "metadata" jsonb,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Create index on status for filtering
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feedback_status_idx" ON "feedback" ("status");
    `)

    // Create index on created_at for sorting
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feedback_created_at_idx" ON "feedback" ("created_at");
    `)

    // Create foreign key to users
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "feedback"
            ADD CONSTRAINT "feedback_user_id_users_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Created feedback collection')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        DROP TABLE IF EXISTS "feedback" CASCADE;
        DROP TYPE IF EXISTS "enum_feedback_platform";
        DROP TYPE IF EXISTS "enum_feedback_status";
    `)
}
