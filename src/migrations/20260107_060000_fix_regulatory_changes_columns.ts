/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix Regulatory Changes columns
 *
 * Renames generated_article to generated_article_id for proper relationship handling.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Fixing regulatory_changes columns...')

    // Check if table exists
    const tableCheckResult = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'regulatory_changes'
        ) as exists;
    `)

    const tableExists = tableCheckResult.rows?.[0]?.exists ?? false

    if (!tableExists) {
        console.log('[Migration] regulatory_changes table does not exist, skipping migration')
        return
    }

    // Rename generated_article to generated_article_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "regulatory_changes" RENAME COLUMN "generated_article" TO "generated_article_id";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    // Add index for the relationship column
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "regulatory_changes_generated_article_id_idx"
        ON "regulatory_changes" ("generated_article_id");
    `)

    // Add foreign key constraint
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "regulatory_changes"
            ADD CONSTRAINT "regulatory_changes_generated_article_id_fk"
            FOREIGN KEY ("generated_article_id") REFERENCES "articles"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Fixed regulatory_changes columns')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Reverting regulatory_changes columns...')

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "regulatory_changes" RENAME COLUMN "generated_article_id" TO "generated_article";
        EXCEPTION
            WHEN undefined_column THEN NULL;
        END $$;
    `)

    console.log('[Migration] Reverted regulatory_changes columns')
}
