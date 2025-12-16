import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create new types
  await db.execute(sql`
    CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'testing', 'writing', 'review', 'published');
    CREATE TYPE "public"."enum_products_price_range" AS ENUM('$', '$$', '$$$', '$$$$');
    CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'review', 'published');
  `)

  // Create new tables
  await db.execute(sql`
    CREATE TABLE "products_purchase_links" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "retailer" varchar NOT NULL,
      "url" varchar NOT NULL,
      "price" varchar,
      "is_affiliate" boolean DEFAULT true
    );
    
    CREATE TABLE "products_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );
    
    CREATE TABLE "articles_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "products_id" integer
    );
  `)

  // Add slug to categories - first as nullable, then populate, then set NOT NULL
  await db.execute(sql`
    ALTER TABLE "categories" ADD COLUMN "slug" varchar;
  `)
  await db.execute(sql`
    UPDATE "categories" SET "slug" = LOWER(REPLACE("name", ' ', '-')) WHERE "slug" IS NULL;
  `)
  await db.execute(sql`
    ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
  `)

  // Add slug to articles - first as nullable, then populate, then set NOT NULL
  await db.execute(sql`
    ALTER TABLE "articles" ADD COLUMN "slug" varchar;
  `)
  await db.execute(sql`
    UPDATE "articles" SET "slug" = LOWER(REPLACE(REPLACE("title", ' ', '-'), '''', '')) WHERE "slug" IS NULL;
  `)
  await db.execute(sql`
    ALTER TABLE "articles" ALTER COLUMN "slug" SET NOT NULL;
  `)

  // Add category_id to products - nullable since foreign key needs valid reference
  await db.execute(sql`
    ALTER TABLE "products" ADD COLUMN "category_id" integer;
  `)

  // Update articles category enum
  await db.execute(sql`
    ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE text;
    DROP TYPE "public"."enum_articles_category";
    CREATE TYPE "public"."enum_articles_category" AS ENUM('buying-guide', 'investigation', 'deals', 'behind-the-scenes', 'health', 'news', 'comparison');
  `)

  // Map old category values to new ones
  await db.execute(sql`
    UPDATE "articles" SET "category" = 'buying-guide' WHERE "category" = 'Buying Guide';
    UPDATE "articles" SET "category" = 'investigation' WHERE "category" = 'Investigation';
    UPDATE "articles" SET "category" = 'deals' WHERE "category" = 'Deals';
    UPDATE "articles" SET "category" = 'behind-the-scenes' WHERE "category" = 'Behind the Scenes';
    UPDATE "articles" SET "category" = 'health' WHERE "category" = 'Health';
    UPDATE "articles" SET "category" = 'news' WHERE "category" = 'News';
  `)

  await db.execute(sql`
    ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE "public"."enum_articles_category" USING "category"::"public"."enum_articles_category";
  `)

  // Other products alterations
  await db.execute(sql`
    ALTER TABLE "products" ALTER COLUMN "overall_score" DROP NOT NULL;
    ALTER TABLE "products" ALTER COLUMN "is_best_buy" DROP DEFAULT;
    ALTER TABLE "products" ALTER COLUMN "is_recommended" DROP DEFAULT;
    ALTER TABLE "products" ADD COLUMN "rank_in_category" numeric;
    ALTER TABLE "products" ADD COLUMN "badges_is_best_in_category" boolean;
    ALTER TABLE "products" ADD COLUMN "badges_is_recommended" boolean;
    ALTER TABLE "products" ADD COLUMN "badges_is_best_value" boolean;
    ALTER TABLE "products" ADD COLUMN "badges_is_editors_choice" boolean;
    ALTER TABLE "products" ADD COLUMN "status" "enum_products_status" DEFAULT 'draft';
    ALTER TABLE "products" ADD COLUMN "full_review" jsonb;
    ALTER TABLE "products" ADD COLUMN "testing_info_review_date" timestamp(3) with time zone;
    ALTER TABLE "products" ADD COLUMN "testing_info_last_tested_date" timestamp(3) with time zone;
    ALTER TABLE "products" ADD COLUMN "testing_info_version_tested" varchar;
    ALTER TABLE "products" ADD COLUMN "testing_info_update_notes" varchar;
  `)

  // Handle price_range column type change
  await db.execute(sql`
    ALTER TABLE "products" ALTER COLUMN "price_range" SET DATA TYPE varchar;
  `)
  await db.execute(sql`
    UPDATE "products" SET "price_range" = '$$' WHERE "price_range" IS NULL OR "price_range" NOT IN ('$', '$$', '$$$', '$$$$');
  `)
  await db.execute(sql`
    ALTER TABLE "products" ALTER COLUMN "price_range" SET DATA TYPE "public"."enum_products_price_range" USING "price_range"::"public"."enum_products_price_range";
    ALTER TABLE "products" ALTER COLUMN "price_range" SET DEFAULT '$$'::"public"."enum_products_price_range";
  `)

  // Other articles alterations
  await db.execute(sql`
    ALTER TABLE "articles" ALTER COLUMN "image_url" DROP NOT NULL;
    ALTER TABLE "articles" ADD COLUMN "image_id" integer;
    ALTER TABLE "articles" ADD COLUMN "status" "enum_articles_status" DEFAULT 'draft';
    ALTER TABLE "articles" ADD COLUMN "featured" boolean DEFAULT false;
  `)

  // Other categories alterations
  await db.execute(sql`
    ALTER TABLE "categories" ADD COLUMN "description" varchar;
    ALTER TABLE "categories" ADD COLUMN "featured" boolean DEFAULT false;
    ALTER TABLE "categories" ADD COLUMN "sort_order" numeric DEFAULT 0;
  `)

  // Add constraints and indexes
  await db.execute(sql`
    ALTER TABLE "products_purchase_links" ADD CONSTRAINT "products_purchase_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "products_purchase_links_order_idx" ON "products_purchase_links" USING btree ("_order");
    CREATE INDEX "products_purchase_links_parent_id_idx" ON "products_purchase_links" USING btree ("_parent_id");
    CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
    CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
    CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
    CREATE INDEX "products_rels_products_id_idx" ON "products_rels" USING btree ("products_id");
    CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
    CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
    CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
    CREATE INDEX "articles_rels_products_id_idx" ON "articles_rels" USING btree ("products_id");
    ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "articles" ADD CONSTRAINT "articles_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
    CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
    CREATE INDEX "articles_image_idx" ON "articles" USING btree ("image_id");
    CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  `)

  // Drop old columns
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "category";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "review_date";
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_purchase_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_purchase_links" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "articles_rels" CASCADE;
  ALTER TABLE "products" DROP CONSTRAINT "products_category_id_categories_id_fk";
  
  ALTER TABLE "articles" DROP CONSTRAINT "articles_image_id_media_id_fk";
  
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_articles_category";
  CREATE TYPE "public"."enum_articles_category" AS ENUM('Buying Guide', 'Investigation', 'Deals', 'Behind the Scenes', 'Health', 'News');
  ALTER TABLE "articles" ALTER COLUMN "category" SET DATA TYPE "public"."enum_articles_category" USING "category"::"public"."enum_articles_category";
  DROP INDEX "products_category_idx";
  DROP INDEX "articles_slug_idx";
  DROP INDEX "articles_image_idx";
  DROP INDEX "categories_slug_idx";
  ALTER TABLE "products" ALTER COLUMN "overall_score" SET NOT NULL;
  ALTER TABLE "products" ALTER COLUMN "price_range" SET DATA TYPE varchar;
  ALTER TABLE "products" ALTER COLUMN "price_range" SET DEFAULT '$-$$';
  ALTER TABLE "products" ALTER COLUMN "is_best_buy" SET DEFAULT false;
  ALTER TABLE "products" ALTER COLUMN "is_recommended" SET DEFAULT false;
  ALTER TABLE "articles" ALTER COLUMN "image_url" SET NOT NULL;
  ALTER TABLE "products" ADD COLUMN "category" varchar NOT NULL;
  ALTER TABLE "products" ADD COLUMN "review_date" timestamp(3) with time zone;
  ALTER TABLE "products" DROP COLUMN "category_id";
  ALTER TABLE "products" DROP COLUMN "rank_in_category";
  ALTER TABLE "products" DROP COLUMN "badges_is_best_in_category";
  ALTER TABLE "products" DROP COLUMN "badges_is_recommended";
  ALTER TABLE "products" DROP COLUMN "badges_is_best_value";
  ALTER TABLE "products" DROP COLUMN "badges_is_editors_choice";
  ALTER TABLE "products" DROP COLUMN "status";
  ALTER TABLE "products" DROP COLUMN "full_review";
  ALTER TABLE "products" DROP COLUMN "testing_info_review_date";
  ALTER TABLE "products" DROP COLUMN "testing_info_last_tested_date";
  ALTER TABLE "products" DROP COLUMN "testing_info_version_tested";
  ALTER TABLE "products" DROP COLUMN "testing_info_update_notes";
  ALTER TABLE "articles" DROP COLUMN "slug";
  ALTER TABLE "articles" DROP COLUMN "image_id";
  ALTER TABLE "articles" DROP COLUMN "status";
  ALTER TABLE "articles" DROP COLUMN "featured";
  ALTER TABLE "categories" DROP COLUMN "slug";
  ALTER TABLE "categories" DROP COLUMN "description";
  ALTER TABLE "categories" DROP COLUMN "featured";
  ALTER TABLE "categories" DROP COLUMN "sort_order";
  DROP TYPE "public"."enum_products_status";
  DROP TYPE "public"."enum_products_price_range";
  DROP TYPE "public"."enum_articles_status";`)
}
