import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add featured_product_id and featured_product_headline to site_settings
  // Only run if the table exists (Payload creates global tables on first access)
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'site_settings') THEN
        BEGIN
          ALTER TABLE "site_settings" ADD COLUMN "featured_product_id" integer REFERENCES "products"("id") ON DELETE SET NULL;
        EXCEPTION
          WHEN duplicate_column THEN null;
        END;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'site_settings') THEN
        BEGIN
          ALTER TABLE "site_settings" ADD COLUMN "featured_product_headline" varchar DEFAULT 'Featured Finding';
        EXCEPTION
          WHEN duplicate_column THEN null;
        END;
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "featured_product_id"`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "featured_product_headline"`)
}
