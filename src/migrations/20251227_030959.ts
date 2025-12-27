import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_products_status" ADD VALUE 'ai_draft' BEFORE 'draft';
  ALTER TABLE "users" ADD COLUMN "free_unlock_credits" numeric DEFAULT 1;
  ALTER TABLE "users" ADD COLUMN "unlocked_products" jsonb DEFAULT '[]'::jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'draft'::text;
  DROP TYPE "public"."enum_products_status";
  CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'testing', 'writing', 'review', 'published');
  ALTER TABLE "products" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."enum_products_status";
  ALTER TABLE "products" ALTER COLUMN "status" SET DATA TYPE "public"."enum_products_status" USING "status"::"public"."enum_products_status";
  ALTER TABLE "users" DROP COLUMN "free_unlock_credits";
  ALTER TABLE "users" DROP COLUMN "unlocked_products";`)
}
