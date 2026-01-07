import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Enhance Feedback collection with user attribution fields
 *
 * Adds:
 * - feedback_type: categorize feedback (bug, feature request, etc.)
 * - product_id: link feedback to specific products
 * - app_version: track which version feedback came from
 * - admin_response: allow admin responses to users
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Create enum for feedback type
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_feedback_feedback_type" AS ENUM (
                'general',
                'bug_report',
                'feature_request',
                'complaint',
                'praise',
                'product_question'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add feedback_type column
    await db.execute(sql`
        ALTER TABLE "feedback"
        ADD COLUMN IF NOT EXISTS "feedback_type" "enum_feedback_feedback_type" DEFAULT 'general';
    `)

    // Add product_id column for product-related feedback
    await db.execute(sql`
        ALTER TABLE "feedback"
        ADD COLUMN IF NOT EXISTS "product_id" integer;
    `)

    // Add app_version column
    await db.execute(sql`
        ALTER TABLE "feedback"
        ADD COLUMN IF NOT EXISTS "app_version" varchar;
    `)

    // Add admin_response column
    await db.execute(sql`
        ALTER TABLE "feedback"
        ADD COLUMN IF NOT EXISTS "admin_response" varchar;
    `)

    // Create foreign key to products
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "feedback"
            ADD CONSTRAINT "feedback_product_id_products_id_fk"
            FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create index on feedback_type for filtering
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feedback_feedback_type_idx" ON "feedback" ("feedback_type");
    `)

    // Create index on user_id for user attribution queries
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "feedback_user_id_idx" ON "feedback" ("user_id");
    `)

    console.log('[Migration] Enhanced feedback collection with user attribution fields')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
        ALTER TABLE "feedback" DROP COLUMN IF EXISTS "feedback_type";
        ALTER TABLE "feedback" DROP COLUMN IF EXISTS "product_id";
        ALTER TABLE "feedback" DROP COLUMN IF EXISTS "app_version";
        ALTER TABLE "feedback" DROP COLUMN IF EXISTS "admin_response";
        DROP INDEX IF EXISTS "feedback_feedback_type_idx";
        DROP INDEX IF EXISTS "feedback_user_id_idx";
        DROP TYPE IF EXISTS "enum_feedback_feedback_type";
    `)
}
