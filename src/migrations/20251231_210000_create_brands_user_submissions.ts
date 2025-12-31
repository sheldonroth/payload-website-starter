import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create missing brands and user_submissions tables
 * These collections were defined but never had migrations created
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Creating brands and user_submissions tables...')

    // Create enum types for brands
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_brands_trust_grade" AS ENUM('A', 'B', 'C', 'D', 'F');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_brands_recalls_severity" AS ENUM('class_i', 'class_ii', 'class_iii');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_brands_recalls_source" AS ENUM('fda', 'cpsc', 'usda', 'voluntary');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create brands table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brands" (
            "id" serial PRIMARY KEY NOT NULL,
            "name" varchar NOT NULL UNIQUE,
            "slug" varchar UNIQUE,
            "parent_company" varchar,
            "trust_score" numeric,
            "trust_grade" "enum_brands_trust_grade",
            "trust_score_last_calculated" timestamp(3) with time zone,
            "score_breakdown_ingredient_quality" numeric,
            "score_breakdown_recall_history" numeric,
            "score_breakdown_transparency" numeric,
            "score_breakdown_consistency" numeric,
            "score_breakdown_responsiveness" numeric,
            "product_count" numeric DEFAULT 0,
            "avoid_count" numeric DEFAULT 0,
            "recall_count" numeric DEFAULT 0,
            "website" varchar,
            "logo_id" integer,
            "description" varchar,
            "notes" varchar,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created brands table')

    // Create brands_aliases array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brands_aliases" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "alias" varchar NOT NULL
        );
    `)

    // Create brands_recalls array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brands_recalls" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "recall_number" varchar NOT NULL,
            "date" timestamp(3) with time zone,
            "reason" varchar,
            "severity" "enum_brands_recalls_severity",
            "source" "enum_brands_recalls_source"
        );
    `)

    // Create brands_rels for category relationships
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "brands_rels" (
            "id" serial PRIMARY KEY NOT NULL,
            "order" integer,
            "parent_id" integer NOT NULL,
            "path" varchar NOT NULL,
            "categories_id" integer
        );
    `)

    // Add foreign keys for brands
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "brands_aliases" ADD CONSTRAINT "brands_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "brands"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "brands_recalls" ADD CONSTRAINT "brands_recalls_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "brands"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "brands" ADD CONSTRAINT "brands_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "media"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "brands_rels" ADD CONSTRAINT "brands_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "brands"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "brands_rels" ADD CONSTRAINT "brands_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "categories"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Created brands related tables and constraints')

    // Create enum types for user_submissions
    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_user_submissions_type" AS ENUM('product_scan', 'tip', 'reaction_report', 'correction', 'product_request');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_user_submissions_status" AS ENUM('pending', 'reviewing', 'verified', 'rejected', 'duplicate', 'spam');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_user_submissions_images_image_type" AS ENUM('front', 'back', 'ingredients', 'nutrition', 'barcode', 'other');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_user_submissions_reaction_details_symptoms" AS ENUM('skin', 'digestive', 'headache', 'allergic', 'behavioral', 'other');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            CREATE TYPE "public"."enum_user_submissions_reaction_details_severity" AS ENUM('mild', 'moderate', 'severe', 'medical');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    // Create user_submissions table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_submissions" (
            "id" serial PRIMARY KEY NOT NULL,
            "type" "enum_user_submissions_type" NOT NULL,
            "submitter_email" varchar,
            "submitter_name" varchar,
            "submitter_ip" varchar,
            "product_id" integer,
            "content" varchar,
            "barcode" varchar,
            "reaction_details_suspected_ingredient" varchar,
            "reaction_details_severity" "enum_user_submissions_reaction_details_severity",
            "extracted_data" jsonb,
            "ai_confidence" numeric,
            "status" "enum_user_submissions_status" DEFAULT 'pending' NOT NULL,
            "moderator_notes" varchar,
            "points_awarded" numeric DEFAULT 0,
            "featured" boolean DEFAULT false,
            "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
            "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
        );
    `)
    console.log('[Migration] Created user_submissions table')

    // Create user_submissions_images array table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_submissions_images" (
            "_order" integer NOT NULL,
            "_parent_id" integer NOT NULL,
            "id" varchar PRIMARY KEY NOT NULL,
            "image_id" integer,
            "image_type" "enum_user_submissions_images_image_type"
        );
    `)

    // Create user_submissions_reaction_details_symptoms array table (for hasMany select)
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "user_submissions_reaction_details_symptoms" (
            "order" integer NOT NULL,
            "parent_id" integer NOT NULL,
            "value" "enum_user_submissions_reaction_details_symptoms",
            "id" serial PRIMARY KEY NOT NULL
        );
    `)

    // Add foreign keys for user_submissions
    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "user_submissions" ADD CONSTRAINT "user_submissions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "user_submissions_images" ADD CONSTRAINT "user_submissions_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "user_submissions"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "user_submissions_images" ADD CONSTRAINT "user_submissions_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE set null ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    await db.execute(sql`
        DO $$ BEGIN
            ALTER TABLE "user_submissions_reaction_details_symptoms" ADD CONSTRAINT "user_submissions_reaction_details_symptoms_parent_id_fk" FOREIGN KEY ("parent_id") REFERENCES "user_submissions"("id") ON DELETE cascade ON UPDATE no action;
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    `)

    console.log('[Migration] Created user_submissions related tables and constraints')

    // Create indexes for better performance
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "brands_name_idx" ON "brands" USING btree ("name");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "brands_slug_idx" ON "brands" USING btree ("slug");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "brands_created_at_idx" ON "brands" USING btree ("created_at");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "brands_updated_at_idx" ON "brands" USING btree ("updated_at");`)

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "user_submissions_type_idx" ON "user_submissions" USING btree ("type");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "user_submissions_status_idx" ON "user_submissions" USING btree ("status");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "user_submissions_submitter_email_idx" ON "user_submissions" USING btree ("submitter_email");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "user_submissions_created_at_idx" ON "user_submissions" USING btree ("created_at");`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "user_submissions_updated_at_idx" ON "user_submissions" USING btree ("updated_at");`)

    console.log('[Migration] Created indexes')
    console.log('[Migration] brands and user_submissions tables created successfully!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    // Drop tables in reverse order (children first)
    await db.execute(sql`DROP TABLE IF EXISTS "user_submissions_reaction_details_symptoms" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "user_submissions_images" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "user_submissions" CASCADE;`)

    await db.execute(sql`DROP TABLE IF EXISTS "brands_rels" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "brands_recalls" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "brands_aliases" CASCADE;`)
    await db.execute(sql`DROP TABLE IF EXISTS "brands" CASCADE;`)

    // Drop enum types
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_submissions_reaction_details_severity";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_submissions_reaction_details_symptoms";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_submissions_images_image_type";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_submissions_status";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_user_submissions_type";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_brands_recalls_source";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_brands_recalls_severity";`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_brands_trust_grade";`)
}
