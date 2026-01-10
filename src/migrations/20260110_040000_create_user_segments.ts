/**
 * Database Migration - Create User Segments Collection
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create user_segments table for behavioral targeting
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating user_segments table...')

    // Create enum for rule logic (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_user_segments_rule_logic') THEN
                CREATE TYPE "public"."enum_user_segments_rule_logic" AS ENUM(
                    'all',
                    'any'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create main user_segments table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_segments" (
            "id" serial PRIMARY KEY NOT NULL,
            "name" varchar NOT NULL,
            "slug" varchar NOT NULL UNIQUE,
            "description" varchar,
            "rule_logic" "enum_user_segments_rule_logic" DEFAULT 'all',
            "sync_to_statsig" boolean DEFAULT false,
            "statsig_gate_name" varchar,
            "statsig_property_name" varchar,
            "sync_to_revenue_cat" boolean DEFAULT false,
            "revenue_cat_attribute" varchar,
            "is_active" boolean DEFAULT true,
            "priority" numeric DEFAULT 0,
            "estimated_size" numeric,
            "last_synced_at" timestamp(3) with time zone,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)

    // Create enum for rule fields (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_user_segments_rules_field') THEN
                CREATE TYPE "public"."enum_user_segments_rules_field" AS ENUM(
                    'scan_count',
                    'days_since_install',
                    'subscription_status',
                    'last_active_days',
                    'streak_days',
                    'badge_count',
                    'referral_count',
                    'platform',
                    'app_version',
                    'products_viewed',
                    'votes_cast'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create enum for rule operators (check existence first)
    await db.execute(sql`
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_user_segments_rules_operator') THEN
                CREATE TYPE "public"."enum_user_segments_rules_operator" AS ENUM(
                    'gt',
                    'lt',
                    'eq',
                    'gte',
                    'lte',
                    'neq',
                    'contains'
                );
            END IF;
        EXCEPTION
            WHEN duplicate_object THEN null;
            WHEN unique_violation THEN null;
        END $$;
    `)

    // Create rules array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_segments_rules" (
            "id" serial PRIMARY KEY NOT NULL,
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "field" "enum_user_segments_rules_field" NOT NULL,
            "operator" "enum_user_segments_rules_operator" NOT NULL,
            "value" varchar NOT NULL
        );
    `)

    // Add foreign key for rules
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "user_segments_rules"
            ADD CONSTRAINT "user_segments_rules_parent_id_fk"
            FOREIGN KEY ("_parent_id") REFERENCES "user_segments"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create indexes
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_segments_slug_idx" ON "user_segments" USING btree ("slug");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_segments_is_active_idx" ON "user_segments" USING btree ("is_active");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_segments_priority_idx" ON "user_segments" USING btree ("priority");
    `)
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "user_segments_rules_order_idx" ON "user_segments_rules" USING btree ("_order", "_parent_id");
    `)

    // Add to payload_locked_documents_rels
    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "user_segments_id" integer;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "payload_locked_documents_rels"
            ADD CONSTRAINT "payload_locked_documents_rels_user_segments_fk"
            FOREIGN KEY ("user_segments_id") REFERENCES "user_segments"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] User segments table created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back user_segments...')

    await db.execute(sql`
        ALTER TABLE "payload_locked_documents_rels"
        DROP COLUMN IF EXISTS "user_segments_id";
    `)

    await db.execute(sql`DROP TABLE IF EXISTS "user_segments_rules" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "user_segments" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_segments_rule_logic";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_segments_rules_field";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_segments_rules_operator";`)

    console.log('[Migration] User segments rollback completed')
}
