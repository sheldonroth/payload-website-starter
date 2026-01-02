import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add featured_product_id and featured_product_headline to site_settings
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "site_settings" ADD COLUMN "featured_product_id" integer REFERENCES "products"("id") ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
  
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "site_settings" ADD COLUMN "featured_product_headline" varchar DEFAULT 'Featured Finding';
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "featured_product_id"`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "featured_product_headline"`)
}
