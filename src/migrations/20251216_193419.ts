import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_category" AS ENUM('Buying Guide', 'Investigation', 'Deals', 'Behind the Scenes', 'Health', 'News');
  CREATE TABLE "products_pros" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "products_cons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"brand" varchar NOT NULL,
  	"category" varchar NOT NULL,
  	"image_url" varchar,
  	"image_id" integer,
  	"overall_score" numeric NOT NULL,
  	"price_range" varchar DEFAULT '$-$$',
  	"ratings_performance" numeric,
  	"ratings_reliability" numeric,
  	"ratings_value_for_money" numeric,
  	"ratings_features" numeric,
  	"summary" varchar,
  	"review_date" timestamp(3) with time zone,
  	"is_best_buy" boolean DEFAULT false,
  	"is_recommended" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "articles_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"excerpt" varchar NOT NULL,
  	"content" jsonb NOT NULL,
  	"image_url" varchar NOT NULL,
  	"category" "enum_articles_category" NOT NULL,
  	"author" varchar NOT NULL,
  	"published_at" timestamp(3) with time zone NOT NULL,
  	"read_time" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "categories_slug_idx";
  ALTER TABLE "categories" ADD COLUMN "name" varchar;
  UPDATE "categories" SET "name" = "title";
  ALTER TABLE "categories" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "categories" ADD COLUMN "icon" varchar;
  ALTER TABLE "categories" ADD COLUMN "product_count" numeric DEFAULT 0;
  ALTER TABLE "categories" ADD COLUMN "image_url" varchar;
  ALTER TABLE "categories" ADD COLUMN "image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "articles_id" integer;
  ALTER TABLE "products_pros" ADD CONSTRAINT "products_pros_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_cons" ADD CONSTRAINT "products_cons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_tags" ADD CONSTRAINT "articles_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_pros_order_idx" ON "products_pros" USING btree ("_order");
  CREATE INDEX "products_pros_parent_id_idx" ON "products_pros" USING btree ("_parent_id");
  CREATE INDEX "products_cons_order_idx" ON "products_cons" USING btree ("_order");
  CREATE INDEX "products_cons_parent_id_idx" ON "products_cons" USING btree ("_parent_id");
  CREATE INDEX "products_image_idx" ON "products" USING btree ("image_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "articles_tags_order_idx" ON "articles_tags" USING btree ("_order");
  CREATE INDEX "articles_tags_parent_id_idx" ON "articles_tags" USING btree ("_parent_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  ALTER TABLE "categories" ADD CONSTRAINT "categories_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "categories_image_idx" ON "categories" USING btree ("image_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  ALTER TABLE "categories" DROP COLUMN "title";
  ALTER TABLE "categories" DROP COLUMN "generate_slug";
  ALTER TABLE "categories" DROP COLUMN "slug";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_pros" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_cons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "articles" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_pros" CASCADE;
  DROP TABLE "products_cons" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "articles_tags" CASCADE;
  DROP TABLE "articles" CASCADE;
  ALTER TABLE "categories" DROP CONSTRAINT "categories_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_articles_fk";
  
  DROP INDEX "categories_image_idx";
  DROP INDEX "payload_locked_documents_rels_products_id_idx";
  DROP INDEX "payload_locked_documents_rels_articles_id_idx";
  ALTER TABLE "categories" ADD COLUMN "title" varchar NOT NULL;
  ALTER TABLE "categories" ADD COLUMN "generate_slug" boolean DEFAULT true;
  ALTER TABLE "categories" ADD COLUMN "slug" varchar NOT NULL;
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  ALTER TABLE "categories" DROP COLUMN "name";
  ALTER TABLE "categories" DROP COLUMN "icon";
  ALTER TABLE "categories" DROP COLUMN "product_count";
  ALTER TABLE "categories" DROP COLUMN "image_url";
  ALTER TABLE "categories" DROP COLUMN "image_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "products_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "articles_id";
  DROP TYPE "public"."enum_articles_category";`)
}
