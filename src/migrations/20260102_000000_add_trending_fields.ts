import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add trending fields to brands
  await db.execute(sql`
    ALTER TABLE "brands"
    ADD COLUMN IF NOT EXISTS "trending_is_trending" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "trending_trending_score" integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "trending_trending_sentiment" varchar,
    ADD COLUMN IF NOT EXISTS "trending_trending_reason" text,
    ADD COLUMN IF NOT EXISTS "trending_recent_news_count" integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "trending_last_trending_check" timestamp with time zone;
  `)

  // Add trending fields to products
  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "trending_is_trending" boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS "trending_trending_score" integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "trending_trending_sentiment" varchar,
    ADD COLUMN IF NOT EXISTS "trending_trending_reason" text;
  `)

  // Create trending_news table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "trending_news" (
      "id" serial PRIMARY KEY,
      "brand_id" integer REFERENCES "brands"("id") ON DELETE CASCADE,
      "title" varchar NOT NULL,
      "source" varchar,
      "url" varchar,
      "published_at" timestamp with time zone,
      "sentiment" varchar,
      "relevance_score" numeric,
      "matched_terms" varchar,
      "created_at" timestamp with time zone DEFAULT now(),
      "updated_at" timestamp with time zone DEFAULT now()
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "trending_news_brand_idx" ON "trending_news" ("brand_id");
  `)

  console.log('Added trending fields to brands and products, created trending_news table')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "brands"
    DROP COLUMN IF EXISTS "trending_is_trending",
    DROP COLUMN IF EXISTS "trending_trending_score",
    DROP COLUMN IF EXISTS "trending_trending_sentiment",
    DROP COLUMN IF EXISTS "trending_trending_reason",
    DROP COLUMN IF EXISTS "trending_recent_news_count",
    DROP COLUMN IF EXISTS "trending_last_trending_check";
  `)

  await db.execute(sql`
    ALTER TABLE "products"
    DROP COLUMN IF EXISTS "trending_is_trending",
    DROP COLUMN IF EXISTS "trending_trending_score",
    DROP COLUMN IF EXISTS "trending_trending_sentiment",
    DROP COLUMN IF EXISTS "trending_trending_reason";
  `)

  await db.execute(sql`DROP TABLE IF EXISTS "trending_news";`)

  console.log('Removed trending fields and dropped trending_news table')
}
