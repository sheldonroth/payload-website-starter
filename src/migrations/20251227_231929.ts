import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_categories_icon" AS ENUM('pill', 'apple', 'baby', 'droplets', 'sparkles', 'pawprint', 'home', 'spraycan', 'microscope', 'heart', 'leaf', 'sun', 'dumbbell', 'brain', 'candy', 'cookie', 'coffee', 'search');
  CREATE TYPE "public"."enum_sponsored_test_requests_status" AS ENUM('pending', 'testing', 'complete', 'refunded');
  CREATE TABLE "sponsored_test_requests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"stripe_payment_id" varchar,
  	"status" "enum_sponsored_test_requests_status" DEFAULT 'pending' NOT NULL,
  	"notes" varchar,
  	"report_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "categories" ALTER COLUMN "icon" SET DEFAULT 'search'::"public"."enum_categories_icon";
  ALTER TABLE "categories" ALTER COLUMN "icon" SET DATA TYPE "public"."enum_categories_icon" USING "icon"::"public"."enum_categories_icon";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sponsored_test_requests_id" integer;
  CREATE INDEX "sponsored_test_requests_updated_at_idx" ON "sponsored_test_requests" USING btree ("updated_at");
  CREATE INDEX "sponsored_test_requests_created_at_idx" ON "sponsored_test_requests" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sponsored_test_requests_fk" FOREIGN KEY ("sponsored_test_requests_id") REFERENCES "public"."sponsored_test_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_sponsored_test_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("sponsored_test_requests_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sponsored_test_requests" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sponsored_test_requests" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sponsored_test_requests_fk";
  
  DROP INDEX "payload_locked_documents_rels_sponsored_test_requests_id_idx";
  ALTER TABLE "categories" ALTER COLUMN "icon" SET DATA TYPE varchar;
  ALTER TABLE "categories" ALTER COLUMN "icon" DROP DEFAULT;
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sponsored_test_requests_id";
  DROP TYPE "public"."enum_categories_icon";
  DROP TYPE "public"."enum_sponsored_test_requests_status";`)
}
