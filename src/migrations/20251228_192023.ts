import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_verdict" AS ENUM('recommend', 'caution', 'avoid', 'pending');
  CREATE TYPE "public"."enum_products_auto_verdict" AS ENUM('recommend', 'caution', 'avoid');
  CREATE TYPE "public"."enum_ingredients_sources_type" AS ENUM('video', 'study', 'lab_report', 'government');
  CREATE TYPE "public"."enum_ingredients_verdict" AS ENUM('safe', 'caution', 'avoid', 'unknown');
  CREATE TYPE "public"."enum_ingredients_category" AS ENUM('artificial_colors', 'artificial_sweeteners', 'preservatives', 'emulsifiers', 'heavy_metals', 'pesticides', 'vitamins_minerals', 'proteins', 'fats_oils', 'sugars', 'fibers', 'other');
  CREATE TYPE "public"."enum_verdict_rules_condition_type" AS ENUM('contains_ingredient', 'missing_ingredient', 'ingredient_verdict', 'category_match');
  CREATE TYPE "public"."enum_verdict_rules_ingredient_verdict_condition" AS ENUM('avoid', 'caution', 'safe_only');
  CREATE TYPE "public"."enum_verdict_rules_action" AS ENUM('set_avoid', 'set_caution', 'set_recommend', 'block_publish', 'warn_only');
  CREATE TABLE "videos_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"ingredients_id" integer
  );
  
  CREATE TABLE "categories_harmful_ingredients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ingredient" varchar NOT NULL,
  	"reason" varchar
  );
  
  CREATE TABLE "categories_quality_indicators" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"indicator" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "ingredients_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alias" varchar NOT NULL
  );
  
  CREATE TABLE "ingredients_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_ingredients_sources_type",
  	"reference" varchar,
  	"notes" varchar
  );
  
  CREATE TABLE "ingredients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"verdict" "enum_ingredients_verdict" DEFAULT 'unknown' NOT NULL,
  	"reason" varchar,
  	"category" "enum_ingredients_category",
  	"source_video_id" integer,
  	"auto_flag_products" boolean DEFAULT true,
  	"flagged_product_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ingredients_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "verdict_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"condition_type" "enum_verdict_rules_condition_type" NOT NULL,
  	"ingredient_verdict_condition" "enum_verdict_rules_ingredient_verdict_condition",
  	"action" "enum_verdict_rules_action" NOT NULL,
  	"warning_message" varchar,
  	"is_active" boolean DEFAULT true,
  	"priority" numeric DEFAULT 0,
  	"applied_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "verdict_rules_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"ingredients_id" integer,
  	"categories_id" integer
  );
  
  ALTER TABLE "products" ADD COLUMN "verdict" "enum_products_verdict" DEFAULT 'pending' NOT NULL;
  ALTER TABLE "products" ADD COLUMN "verdict_reason" varchar;
  ALTER TABLE "products" ADD COLUMN "auto_verdict" "enum_products_auto_verdict";
  ALTER TABLE "products" ADD COLUMN "verdict_override" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "ingredients_raw" varchar;
  ALTER TABLE "products" ADD COLUMN "upc" varchar;
  ALTER TABLE "products" ADD COLUMN "source_url" varchar;
  ALTER TABLE "products" ADD COLUMN "source_video_id" integer;
  ALTER TABLE "products" ADD COLUMN "conflicts" jsonb;
  ALTER TABLE "products_rels" ADD COLUMN "ingredients_id" integer;
  ALTER TABLE "videos" ADD COLUMN "transcript" varchar;
  ALTER TABLE "videos" ADD COLUMN "transcript_updated_at" timestamp(3) with time zone;
  ALTER TABLE "videos" ADD COLUMN "analyzed_at" timestamp(3) with time zone;
  ALTER TABLE "categories" ADD COLUMN "ai_suggested" boolean DEFAULT false;
  ALTER TABLE "categories" ADD COLUMN "ai_source" varchar;
  ALTER TABLE "categories" ADD COLUMN "research_notes" varchar;
  ALTER TABLE "categories" ADD COLUMN "last_enriched_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ingredients_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "verdict_rules_id" integer;
  ALTER TABLE "videos_rels" ADD CONSTRAINT "videos_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "videos_rels" ADD CONSTRAINT "videos_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "videos_rels" ADD CONSTRAINT "videos_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_harmful_ingredients" ADD CONSTRAINT "categories_harmful_ingredients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories_quality_indicators" ADD CONSTRAINT "categories_quality_indicators_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ingredients_aliases" ADD CONSTRAINT "ingredients_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ingredients_sources" ADD CONSTRAINT "ingredients_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_source_video_id_videos_id_fk" FOREIGN KEY ("source_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ingredients_rels" ADD CONSTRAINT "ingredients_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ingredients_rels" ADD CONSTRAINT "ingredients_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "verdict_rules_rels" ADD CONSTRAINT "verdict_rules_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."verdict_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "verdict_rules_rels" ADD CONSTRAINT "verdict_rules_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "verdict_rules_rels" ADD CONSTRAINT "verdict_rules_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "videos_rels_order_idx" ON "videos_rels" USING btree ("order");
  CREATE INDEX "videos_rels_parent_idx" ON "videos_rels" USING btree ("parent_id");
  CREATE INDEX "videos_rels_path_idx" ON "videos_rels" USING btree ("path");
  CREATE INDEX "videos_rels_products_id_idx" ON "videos_rels" USING btree ("products_id");
  CREATE INDEX "videos_rels_ingredients_id_idx" ON "videos_rels" USING btree ("ingredients_id");
  CREATE INDEX "categories_harmful_ingredients_order_idx" ON "categories_harmful_ingredients" USING btree ("_order");
  CREATE INDEX "categories_harmful_ingredients_parent_id_idx" ON "categories_harmful_ingredients" USING btree ("_parent_id");
  CREATE INDEX "categories_quality_indicators_order_idx" ON "categories_quality_indicators" USING btree ("_order");
  CREATE INDEX "categories_quality_indicators_parent_id_idx" ON "categories_quality_indicators" USING btree ("_parent_id");
  CREATE INDEX "ingredients_aliases_order_idx" ON "ingredients_aliases" USING btree ("_order");
  CREATE INDEX "ingredients_aliases_parent_id_idx" ON "ingredients_aliases" USING btree ("_parent_id");
  CREATE INDEX "ingredients_sources_order_idx" ON "ingredients_sources" USING btree ("_order");
  CREATE INDEX "ingredients_sources_parent_id_idx" ON "ingredients_sources" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "ingredients_name_idx" ON "ingredients" USING btree ("name");
  CREATE INDEX "ingredients_source_video_idx" ON "ingredients" USING btree ("source_video_id");
  CREATE INDEX "ingredients_updated_at_idx" ON "ingredients" USING btree ("updated_at");
  CREATE INDEX "ingredients_created_at_idx" ON "ingredients" USING btree ("created_at");
  CREATE INDEX "ingredients_rels_order_idx" ON "ingredients_rels" USING btree ("order");
  CREATE INDEX "ingredients_rels_parent_idx" ON "ingredients_rels" USING btree ("parent_id");
  CREATE INDEX "ingredients_rels_path_idx" ON "ingredients_rels" USING btree ("path");
  CREATE INDEX "ingredients_rels_categories_id_idx" ON "ingredients_rels" USING btree ("categories_id");
  CREATE INDEX "verdict_rules_updated_at_idx" ON "verdict_rules" USING btree ("updated_at");
  CREATE INDEX "verdict_rules_created_at_idx" ON "verdict_rules" USING btree ("created_at");
  CREATE INDEX "verdict_rules_rels_order_idx" ON "verdict_rules_rels" USING btree ("order");
  CREATE INDEX "verdict_rules_rels_parent_idx" ON "verdict_rules_rels" USING btree ("parent_id");
  CREATE INDEX "verdict_rules_rels_path_idx" ON "verdict_rules_rels" USING btree ("path");
  CREATE INDEX "verdict_rules_rels_ingredients_id_idx" ON "verdict_rules_rels" USING btree ("ingredients_id");
  CREATE INDEX "verdict_rules_rels_categories_id_idx" ON "verdict_rules_rels" USING btree ("categories_id");
  ALTER TABLE "products" ADD CONSTRAINT "products_source_video_id_videos_id_fk" FOREIGN KEY ("source_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ingredients_fk" FOREIGN KEY ("ingredients_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verdict_rules_fk" FOREIGN KEY ("verdict_rules_id") REFERENCES "public"."verdict_rules"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "products_upc_idx" ON "products" USING btree ("upc");
  CREATE INDEX "products_source_video_idx" ON "products" USING btree ("source_video_id");
  CREATE INDEX "products_rels_ingredients_id_idx" ON "products_rels" USING btree ("ingredients_id");
  CREATE INDEX "payload_locked_documents_rels_ingredients_id_idx" ON "payload_locked_documents_rels" USING btree ("ingredients_id");
  CREATE INDEX "payload_locked_documents_rels_verdict_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("verdict_rules_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_harmful_ingredients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "categories_quality_indicators" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ingredients_aliases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ingredients_sources" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ingredients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ingredients_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "verdict_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "verdict_rules_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "videos_rels" CASCADE;
  DROP TABLE "categories_harmful_ingredients" CASCADE;
  DROP TABLE "categories_quality_indicators" CASCADE;
  DROP TABLE "ingredients_aliases" CASCADE;
  DROP TABLE "ingredients_sources" CASCADE;
  DROP TABLE "ingredients" CASCADE;
  DROP TABLE "ingredients_rels" CASCADE;
  DROP TABLE "verdict_rules" CASCADE;
  DROP TABLE "verdict_rules_rels" CASCADE;
  ALTER TABLE "products" DROP CONSTRAINT "products_source_video_id_videos_id_fk";
  
  ALTER TABLE "products_rels" DROP CONSTRAINT "products_rels_ingredients_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ingredients_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_verdict_rules_fk";
  
  DROP INDEX "products_upc_idx";
  DROP INDEX "products_source_video_idx";
  DROP INDEX "products_rels_ingredients_id_idx";
  DROP INDEX "payload_locked_documents_rels_ingredients_id_idx";
  DROP INDEX "payload_locked_documents_rels_verdict_rules_id_idx";
  ALTER TABLE "products" DROP COLUMN "verdict";
  ALTER TABLE "products" DROP COLUMN "verdict_reason";
  ALTER TABLE "products" DROP COLUMN "auto_verdict";
  ALTER TABLE "products" DROP COLUMN "verdict_override";
  ALTER TABLE "products" DROP COLUMN "ingredients_raw";
  ALTER TABLE "products" DROP COLUMN "upc";
  ALTER TABLE "products" DROP COLUMN "source_url";
  ALTER TABLE "products" DROP COLUMN "source_video_id";
  ALTER TABLE "products" DROP COLUMN "conflicts";
  ALTER TABLE "products_rels" DROP COLUMN "ingredients_id";
  ALTER TABLE "videos" DROP COLUMN "transcript";
  ALTER TABLE "videos" DROP COLUMN "transcript_updated_at";
  ALTER TABLE "videos" DROP COLUMN "analyzed_at";
  ALTER TABLE "categories" DROP COLUMN "ai_suggested";
  ALTER TABLE "categories" DROP COLUMN "ai_source";
  ALTER TABLE "categories" DROP COLUMN "research_notes";
  ALTER TABLE "categories" DROP COLUMN "last_enriched_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ingredients_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "verdict_rules_id";
  DROP TYPE "public"."enum_products_verdict";
  DROP TYPE "public"."enum_products_auto_verdict";
  DROP TYPE "public"."enum_ingredients_sources_type";
  DROP TYPE "public"."enum_ingredients_verdict";
  DROP TYPE "public"."enum_ingredients_category";
  DROP TYPE "public"."enum_verdict_rules_condition_type";
  DROP TYPE "public"."enum_verdict_rules_ingredient_verdict_condition";
  DROP TYPE "public"."enum_verdict_rules_action";`)
}
