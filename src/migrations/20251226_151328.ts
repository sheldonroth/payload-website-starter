import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_investigation_polls_status" AS ENUM('active', 'closed');
  CREATE TABLE "investigation_polls_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"votes" numeric DEFAULT 0
  );
  
  CREATE TABLE "investigation_polls" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"status" "enum_investigation_polls_status" DEFAULT 'active' NOT NULL,
  	"end_date" timestamp(3) with time zone,
  	"voters" jsonb DEFAULT '{}'::jsonb,
  	"total_votes" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "investigation_polls_id" integer;
  ALTER TABLE "investigation_polls_options" ADD CONSTRAINT "investigation_polls_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."investigation_polls"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "investigation_polls_options_order_idx" ON "investigation_polls_options" USING btree ("_order");
  CREATE INDEX "investigation_polls_options_parent_id_idx" ON "investigation_polls_options" USING btree ("_parent_id");
  CREATE INDEX "investigation_polls_updated_at_idx" ON "investigation_polls" USING btree ("updated_at");
  CREATE INDEX "investigation_polls_created_at_idx" ON "investigation_polls" USING btree ("created_at");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_categories_id_idx" ON "users_rels" USING btree ("categories_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_investigation_polls_fk" FOREIGN KEY ("investigation_polls_id") REFERENCES "public"."investigation_polls"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_investigation_polls_id_idx" ON "payload_locked_documents_rels" USING btree ("investigation_polls_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "investigation_polls_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "investigation_polls" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "investigation_polls_options" CASCADE;
  DROP TABLE "investigation_polls" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_investigation_polls_fk";
  
  DROP INDEX "payload_locked_documents_rels_investigation_polls_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "investigation_polls_id";
  DROP TYPE "public"."enum_investigation_polls_status";`)
}
