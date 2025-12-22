import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_videos_status" AS ENUM('draft', 'published');
  CREATE TABLE "videos_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"youtube_video_id" varchar NOT NULL,
  	"thumbnail_url" varchar,
  	"description" varchar,
  	"duration" numeric,
  	"category_id" integer,
  	"related_product_id" integer,
  	"status" "enum_videos_status" DEFAULT 'draft',
  	"sort_order" numeric DEFAULT 0,
  	"view_count" numeric DEFAULT 0,
  	"is_featured" boolean DEFAULT false,
  	"is_auto_imported" boolean DEFAULT false,
  	"youtube_imported_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "youtube_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"channel_id" varchar,
  	"api_key" varchar,
  	"auto_sync_enabled" boolean DEFAULT false,
  	"max_videos_to_sync" numeric DEFAULT 50,
  	"shorts_only" boolean DEFAULT true,
  	"last_sync_at" timestamp(3) with time zone,
  	"last_sync_status" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "videos_id" integer;
  ALTER TABLE "videos_tags" ADD CONSTRAINT "videos_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "videos" ADD CONSTRAINT "videos_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "videos_tags_order_idx" ON "videos_tags" USING btree ("_order");
  CREATE INDEX "videos_tags_parent_id_idx" ON "videos_tags" USING btree ("_parent_id");
  CREATE INDEX "videos_category_idx" ON "videos" USING btree ("category_id");
  CREATE INDEX "videos_related_product_idx" ON "videos" USING btree ("related_product_id");
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "youtube_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "videos_tags" CASCADE;
  DROP TABLE "videos" CASCADE;
  DROP TABLE "youtube_settings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_videos_fk";
  
  DROP INDEX "payload_locked_documents_rels_videos_id_idx";
  ALTER TABLE "users" DROP COLUMN "is_admin";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "videos_id";
  DROP TYPE "public"."enum_videos_status";`)
}
