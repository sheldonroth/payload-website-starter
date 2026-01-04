import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Product Votes Migration
 *
 * Creates the product_votes table for the "Proof of Possession" voting system.
 * Tracks barcode scan votes for untested products with weighted scoring.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating product_votes table...')

    // ============================================
    // ENUM TYPE
    // ============================================
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_product_votes_status" AS ENUM(
                'collecting_votes',
                'threshold_reached',
                'queued',
                'testing',
                'complete'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)
    console.log('[Migration] Created enum_product_votes_status')

    // ============================================
    // PRODUCT VOTES TABLE
    // ============================================
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "product_votes" (
            "id" serial PRIMARY KEY NOT NULL,
            "barcode" varchar NOT NULL UNIQUE,
            "product_name" varchar,
            "brand" varchar,
            "image_url" varchar,
            "total_weighted_votes" numeric DEFAULT 0 NOT NULL,
            "search_count" numeric DEFAULT 0,
            "scan_count" numeric DEFAULT 0,
            "member_scan_count" numeric DEFAULT 0,
            "unique_voters" numeric DEFAULT 0,
            "funding_threshold" numeric DEFAULT 1000,
            "funding_progress" numeric DEFAULT 0,
            "status" "enum_product_votes_status" DEFAULT 'collecting_votes' NOT NULL,
            "threshold_reached_at" timestamp(3) with time zone,
            "linked_product_id" integer,
            "voter_fingerprints" jsonb DEFAULT '[]',
            "notify_on_complete" jsonb DEFAULT '[]',
            "open_food_facts_data" jsonb,
            "rank" numeric,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created product_votes table')

    // Add foreign key to products (for linked_product after testing)
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "product_votes" ADD CONSTRAINT "product_votes_linked_product_id_products_id_fk"
            FOREIGN KEY ("linked_product_id") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // ============================================
    // INDEXES
    // ============================================
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_votes_barcode_idx" ON "product_votes" USING btree ("barcode");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_votes_total_weighted_votes_idx" ON "product_votes" USING btree ("total_weighted_votes");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_votes_status_idx" ON "product_votes" USING btree ("status");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_votes_created_at_idx" ON "product_votes" USING btree ("created_at");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "product_votes_updated_at_idx" ON "product_votes" USING btree ("updated_at");`)

    console.log('[Migration] Created indexes for product_votes')
    console.log('[Migration] product_votes table created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Dropping product_votes table...')

    // Drop table
    await db.execute(sql`DROP TABLE IF EXISTS "product_votes" CASCADE;`)

    // Drop enum type
    await db.execute(sql`DROP TYPE IF EXISTS "enum_product_votes_status";`)

    console.log('[Migration] product_votes table dropped')
}
