/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 * 
 * Creates the contributor_profiles table which is required for the
 * My Cases feature in the mobile app. This table tracks contributors
 * who document products for testing.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating contributor_profiles table...')

    // Create the table if it doesn't exist
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "contributor_profiles" (
            "id" SERIAL PRIMARY KEY,
            
            -- Identity fields
            "display_name" VARCHAR(255) DEFAULT 'Anonymous Contributor',
            "fingerprint_hash" VARCHAR(255) UNIQUE,
            "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
            "avatar" VARCHAR(255) DEFAULT '🔬',
            "bio" TEXT,
            
            -- Contributor stats
            "contributor_number" INTEGER UNIQUE,
            "documents_submitted" INTEGER DEFAULT 0,
            "products_tested_from_submissions" INTEGER DEFAULT 0,
            "people_helped" INTEGER DEFAULT 0,
            "first_cases" INTEGER DEFAULT 0,
            "contributor_level" VARCHAR(50) DEFAULT 'new',
            
            -- Public profile settings
            "is_public" BOOLEAN DEFAULT true,
            "shareable_slug" VARCHAR(255) UNIQUE,
            
            -- Achievements & history (JSON columns)
            "badges" JSONB DEFAULT '[]'::jsonb,
            "featured_cases" JSONB DEFAULT '[]'::jsonb,
            
            -- Notification preferences
            "notify_on_results" BOOLEAN DEFAULT true,
            "notify_on_milestones" BOOLEAN DEFAULT true,
            
            -- Timestamps
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `)

    // Create indexes for frequently queried columns
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_contributor_profiles_fingerprint_hash" 
        ON "contributor_profiles" ("fingerprint_hash");
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_contributor_profiles_contributor_number" 
        ON "contributor_profiles" ("contributor_number");
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_contributor_profiles_shareable_slug" 
        ON "contributor_profiles" ("shareable_slug");
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "idx_contributor_profiles_user_id" 
        ON "contributor_profiles" ("user_id");
    `)

    console.log('[Migration] ✓ contributor_profiles table created with indexes')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Dropping contributor_profiles table...')

    await db.execute(sql`DROP TABLE IF EXISTS "contributor_profiles" CASCADE;`)

    console.log('[Migration] contributor_profiles table dropped')
}
