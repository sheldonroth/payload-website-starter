import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix Generated Content columns
 *
 * Adds missing columns for comparison relationships and other fields.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Adding missing columns to generated_content...')

    // Add comparison_product_a_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content" ADD COLUMN "comparison_product_a_id" integer;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add comparison_product_b_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content" ADD COLUMN "comparison_product_b_id" integer;
        EXCEPTION
            WHEN duplicate_column THEN NULL;
        END $$;
    `)

    // Add foreign key for comparison_product_a_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content"
            ADD CONSTRAINT "generated_content_comparison_product_a_id_fk"
            FOREIGN KEY ("comparison_product_a_id") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add foreign key for comparison_product_b_id
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content"
            ADD CONSTRAINT "generated_content_comparison_product_b_id_fk"
            FOREIGN KEY ("comparison_product_b_id") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Add indexes for comparison product columns
    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "generated_content_comparison_product_a_id_idx"
        ON "generated_content" ("comparison_product_a_id");
    `)

    await db.execute(sql`
        CREATE INDEX IF NOT EXISTS "generated_content_comparison_product_b_id_idx"
        ON "generated_content" ("comparison_product_b_id");
    `)

    // Create the enum type first (before using in table)
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_generated_content_script_platform" AS ENUM ('tiktok', 'reels', 'shorts');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create script_platform select table for hasMany
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content_script_platform" (
            "order" integer NOT NULL,
            "parent_id" integer NOT NULL,
            "value" "enum_generated_content_script_platform",
            "id" serial PRIMARY KEY NOT NULL
        );
    `)

    // Add foreign key for script_platform
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_script_platform"
            ADD CONSTRAINT "generated_content_script_platform_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "generated_content"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create the enum type first (before using in table)
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "enum_generated_content_legal_flags" AS ENUM ('health_claims', 'brand_controversy', 'comparative_claims', 'needs_citation', 'cleared');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create legal_flags select table for hasMany
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "generated_content_legal_flags" (
            "order" integer NOT NULL,
            "parent_id" integer NOT NULL,
            "value" "enum_generated_content_legal_flags",
            "id" serial PRIMARY KEY NOT NULL
        );
    `)

    // Add foreign key for legal_flags
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "generated_content_legal_flags"
            ADD CONSTRAINT "generated_content_legal_flags_parent_fk"
            FOREIGN KEY ("parent_id") REFERENCES "generated_content"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Fixed generated_content columns')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Reverting generated_content columns...')

    await db.execute(sql`DROP TABLE IF EXISTS "generated_content_script_platform" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "generated_content_legal_flags" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_generated_content_script_platform" CASCADE;`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_generated_content_legal_flags" CASCADE;`)

    console.log('[Migration] Reverted generated_content columns')
}
