/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Update embedding dimension from 1536 (OpenAI) to 768 (Gemini)
 *
 * Gemini's text-embedding-004 uses 768 dimensions which is more cost-effective.
 * This migration drops the old column and recreates it with the correct dimension.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop the old index
  await db.execute(sql`
    DROP INDEX IF EXISTS "idx_products_embedding_hnsw";
  `)

  // Drop and recreate the embedding column with 768 dimensions
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "embedding";
  `)

  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN "embedding" vector(768);
  `)

  // Recreate HNSW index for 768 dimensions
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_products_embedding_hnsw"
    ON "products"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `)

  console.log('[Migration] Updated embedding dimension to 768 for Gemini compatibility')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert to 1536 dimensions (OpenAI)
  await db.execute(sql`
    DROP INDEX IF EXISTS "idx_products_embedding_hnsw";
  `)

  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "embedding";
  `)

  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN "embedding" vector(1536);
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_products_embedding_hnsw"
    ON "products"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `)

  console.log('[Migration] Reverted embedding dimension to 1536 for OpenAI')
}
