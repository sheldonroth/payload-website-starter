import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Create site_settings table for the SiteSettings global
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Create the site_settings table
    await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "site_settings" (
            "id" serial PRIMARY KEY,
            "featured_product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
            "featured_product_headline" varchar DEFAULT 'Featured Finding',
            "affiliate_settings_amazon_affiliate_tag" varchar,
            "affiliate_settings_affiliate_disclosure" text DEFAULT 'As an Amazon Associate we earn from qualifying purchases.',
            "affiliate_settings_enable_affiliate_links" boolean DEFAULT true,
            "site_info_site_name" varchar DEFAULT 'The Product Report',
            "site_info_site_description" text DEFAULT 'Ingredient analysis and product reviews you can trust.',
            "updated_at" timestamp with time zone DEFAULT now(),
            "created_at" timestamp with time zone DEFAULT now()
        );
    `)

    // Insert a default row if none exists
    await db.execute(sql`
        INSERT INTO "site_settings" ("id", "featured_product_headline", "affiliate_settings_enable_affiliate_links", "site_info_site_name", "site_info_site_description")
        SELECT 1, 'Featured Finding', true, 'The Product Report', 'Ingredient analysis and product reviews you can trust.'
        WHERE NOT EXISTS (SELECT 1 FROM "site_settings" LIMIT 1);
    `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`DROP TABLE IF EXISTS "site_settings";`)
}
