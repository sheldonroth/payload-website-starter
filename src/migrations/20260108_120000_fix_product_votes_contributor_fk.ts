/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 *
 * Fixes the product_votes table foreign key constraint.
 * The previous migration dropped scout_profiles but didn't update
 * the product_votes FK to point to contributor_profiles.
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Fixing product_votes FK to contributor_profiles...')

    // Check if product_votes table exists before attempting FK changes
    const tableCheck = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'product_votes'
        );
    `)

    if (!tableCheck.rows[0]?.exists) {
        console.log('[Migration] product_votes table does not exist, skipping')
        return
    }

    // Drop the dangling FK constraint to scout_profiles (if it exists)
    await db.execute(sql`
        ALTER TABLE product_votes
        DROP CONSTRAINT IF EXISTS product_votes_first_scout_id_scout_profiles_id_fk;
    `)
    console.log('[Migration] Dropped dangling FK constraint to scout_profiles')

    // Check if contributor_profiles table exists before adding FK
    const contributorTableCheck = await db.execute(sql`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'contributor_profiles'
        );
    `)

    if (contributorTableCheck.rows[0]?.exists) {
        // Add the correct FK to contributor_profiles
        await db.execute(sql`
            DO $$ BEGIN
                ALTER TABLE product_votes
                ADD CONSTRAINT product_votes_first_scout_id_contributor_profiles_id_fk
                FOREIGN KEY (first_scout_id) REFERENCES contributor_profiles(id) ON DELETE SET NULL;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `)
        console.log('[Migration] Added FK constraint to contributor_profiles')
    } else {
        console.log('[Migration] contributor_profiles table does not exist, skipping FK creation')
    }

    console.log('[Migration] ✓ product_votes FK fixed')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back product_votes FK fix...')

    // Drop the FK to contributor_profiles
    await db.execute(sql`
        ALTER TABLE product_votes
        DROP CONSTRAINT IF EXISTS product_votes_first_scout_id_contributor_profiles_id_fk;
    `)

    console.log('[Migration] product_votes FK rollback complete')
}
