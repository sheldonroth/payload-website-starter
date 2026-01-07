import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    // Drop the foreign key constraint from products to scout_profiles
    await db.execute(sql`
        ALTER TABLE products
        DROP CONSTRAINT IF EXISTS products_scout_attribution_first_scout_id_scout_profiles_id_fk;
    `)

    // Drop the scout_profiles table (it's empty, the other agent created contributor_profiles)
    await db.execute(sql`
        DROP TABLE IF EXISTS scout_profiles CASCADE;
    `)

    // Add foreign key from products to contributor_profiles
    await db.execute(sql`
        ALTER TABLE products
        ADD CONSTRAINT products_scout_attribution_first_scout_id_contributor_profiles_id_fk
        FOREIGN KEY (scout_attribution_first_scout_id) REFERENCES contributor_profiles(id) ON DELETE SET NULL;
    `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    // This migration is not reversible since we're dropping scout_profiles
    throw new Error('Cannot reverse this migration - scout_profiles table was dropped')
}
