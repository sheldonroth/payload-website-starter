/**
 * Database Migration - Create Audit Logs Collection
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create admin_audit_logs table for tracking admin actions
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating admin_audit_logs table...')

    // Create enum for action types (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_admin_audit_logs_action') THEN
                CREATE TYPE "public"."enum_admin_audit_logs_action" AS ENUM(
                    'create',
                    'update',
                    'delete',
                    'login',
                    'logout',
                    'settings_change',
                    'bulk_operation'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create main admin_audit_logs table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
            "id" serial PRIMARY KEY NOT NULL,
            "action" "enum_admin_audit_logs_action" NOT NULL,
            "collection" varchar NOT NULL,
            "document_id" varchar,
            "document_title" varchar,
            "admin_user_id" integer,
            "admin_email" varchar NOT NULL,
            "changes" jsonb,
            "summary" varchar,
            "ip_address" varchar,
            "user_agent" varchar,
            "timestamp" timestamp(3) with time zone NOT NULL DEFAULT now(),
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Add foreign key to users table
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "admin_audit_logs"
            ADD CONSTRAINT "admin_audit_logs_admin_user_id_users_id_fk"
            FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create indexes for efficient querying
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_collection_idx" ON "admin_audit_logs" USING btree ("collection");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_email_idx" ON "admin_audit_logs" USING btree ("admin_email");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_timestamp_idx" ON "admin_audit_logs" USING btree ("timestamp");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "admin_audit_logs_document_id_idx" ON "admin_audit_logs" USING btree ("document_id");
    `)

    // Add to payload_locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "admin_audit_logs_id" integer;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_admin_audit_logs_fk"
            FOREIGN KEY ("admin_audit_logs_id") REFERENCES "admin_audit_logs"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Audit logs table created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back admin_audit_logs...')

    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "admin_audit_logs_id";
    `)

    await db.execute(sql`DROP TABLE IF EXISTS "admin_audit_logs" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_admin_audit_logs_action";`)

    console.log('[Migration] Audit logs rollback completed')
}
