import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create pages_blocks_stats tables for the new Stats block
 * These tables are needed for the Stats block added to Pages collection
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating pages_blocks_stats tables...')

    // Create enum for valueType
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_pages_blocks_stats_stats_value_type" AS ENUM('manual', 'products', 'users', 'categories', 'videos', 'brands');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create enum for icon
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_pages_blocks_stats_stats_icon" AS ENUM('flask', 'users', 'shield', 'check', 'star', 'chart');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create enum for backgroundColor
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_pages_blocks_stats_background_color" AS ENUM('default', 'dark', 'primary');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create main pages_blocks_stats table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "pages_blocks_stats" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "_path" text NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "heading" varchar,
            "background_color" "enum_pages_blocks_stats_background_color" DEFAULT 'default',
            "block_name" varchar
        );
    `)
    console.log('[Migration] Created pages_blocks_stats table')

    // Create pages_blocks_stats_stats array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "pages_blocks_stats_stats" (
            "_order" integer NOT NULL,
            "_parent_id" varchar NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "label" varchar NOT NULL,
            "value_type" "enum_pages_blocks_stats_stats_value_type" DEFAULT 'manual',
            "manual_value" varchar,
            "suffix" varchar,
            "icon" "enum_pages_blocks_stats_stats_icon"
        );
    `)
    console.log('[Migration] Created pages_blocks_stats_stats table')

    // Add foreign key constraints
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "pages_blocks_stats" ADD CONSTRAINT "pages_blocks_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "pages_blocks_stats_stats" ADD CONSTRAINT "pages_blocks_stats_stats_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_stats"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_stats_order_idx" ON "pages_blocks_stats" USING btree ("_order");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_stats_parent_id_idx" ON "pages_blocks_stats" USING btree ("_parent_id");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_stats_path_idx" ON "pages_blocks_stats" USING btree ("_path");`)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_stats_stats_order_idx" ON "pages_blocks_stats_stats" USING btree ("_order");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_stats_stats_parent_id_idx" ON "pages_blocks_stats_stats" USING btree ("_parent_id");`)

    console.log('[Migration] Created indexes')
    console.log('[Migration] pages_blocks_stats tables created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_stats_stats" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_stats" CASCADE;`)

    await db.execute(sql`DROP TYPE IF EXISTS "enum_pages_blocks_stats_background_color";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_pages_blocks_stats_stats_icon";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_pages_blocks_stats_stats_value_type";`)
}
