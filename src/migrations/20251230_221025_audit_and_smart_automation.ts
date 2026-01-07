/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_freshness_status" AS ENUM('fresh', 'needs_review', 'stale');
  CREATE TYPE "public"."enum_audit_log_action" AS ENUM('ai_product_created', 'ai_ingredient_parsed', 'ai_verdict_set', 'rule_applied', 'ingredient_cascade', 'manual_override', 'product_merged', 'category_created', 'image_enriched', 'poll_closed', 'article_generated', 'conflict_detected', 'freshness_check');
  CREATE TYPE "public"."enum_audit_log_source_type" AS ENUM('youtube', 'tiktok', 'amazon', 'web_url', 'barcode', 'manual', 'system', 'rule');
  CREATE TYPE "public"."enum_audit_log_target_collection" AS ENUM('products', 'ingredients', 'categories', 'videos', 'articles', 'investigation-polls');
  CREATE TABLE "products_unmatched_ingredients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_audit_log_action" NOT NULL,
  	"source_type" "enum_audit_log_source_type",
  	"source_id" varchar,
  	"source_url" varchar,
  	"target_collection" "enum_audit_log_target_collection",
  	"target_id" numeric,
  	"target_name" varchar,
  	"before" jsonb,
  	"after" jsonb,
  	"metadata" jsonb,
  	"ai_model" varchar,
  	"confidence" numeric,
  	"performed_by_id" integer,
  	"success" boolean DEFAULT true,
  	"error_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "products" ADD COLUMN "verdict_override_reason" varchar;
  ALTER TABLE "products" ADD COLUMN "verdict_overridden_by_id" integer;
  ALTER TABLE "products" ADD COLUMN "verdict_overridden_at" timestamp(3) with time zone;
  ALTER TABLE "products" ADD COLUMN "rule_applied" varchar;
  ALTER TABLE "products" ADD COLUMN "source_count" numeric DEFAULT 1;
  ALTER TABLE "products" ADD COLUMN "freshness_status" "enum_products_freshness_status";
  ALTER TABLE "categories" ADD COLUMN "inherited_from_parent" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "audit_log_id" integer;
  ALTER TABLE "products_unmatched_ingredients" ADD CONSTRAINT "products_unmatched_ingredients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "products_unmatched_ingredients_order_idx" ON "products_unmatched_ingredients" USING btree ("_order");
  CREATE INDEX "products_unmatched_ingredients_parent_id_idx" ON "products_unmatched_ingredients" USING btree ("_parent_id");
  CREATE INDEX "audit_log_performed_by_idx" ON "audit_log" USING btree ("performed_by_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  ALTER TABLE "products" ADD CONSTRAINT "products_verdict_overridden_by_id_users_id_fk" FOREIGN KEY ("verdict_overridden_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_verdict_overridden_by_idx" ON "products" USING btree ("verdict_overridden_by_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_unmatched_ingredients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "audit_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_unmatched_ingredients" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  ALTER TABLE "products" DROP CONSTRAINT "products_verdict_overridden_by_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_audit_log_fk";
  
  DROP INDEX "products_verdict_overridden_by_idx";
  DROP INDEX "payload_locked_documents_rels_audit_log_id_idx";
  ALTER TABLE "products" DROP COLUMN "verdict_override_reason";
  ALTER TABLE "products" DROP COLUMN "verdict_overridden_by_id";
  ALTER TABLE "products" DROP COLUMN "verdict_overridden_at";
  ALTER TABLE "products" DROP COLUMN "rule_applied";
  ALTER TABLE "products" DROP COLUMN "source_count";
  ALTER TABLE "products" DROP COLUMN "freshness_status";
  ALTER TABLE "categories" DROP COLUMN "inherited_from_parent";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "audit_log_id";
  DROP TYPE "public"."enum_products_freshness_status";
  DROP TYPE "public"."enum_audit_log_action";
  DROP TYPE "public"."enum_audit_log_source_type";
  DROP TYPE "public"."enum_audit_log_target_collection";`)
}
