import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Add pgvector support for semantic search
 *
 * This migration:
 * 1. Enables the pgvector extension (Neon supports this)
 * 2. Adds embedding column to products table (1536 dimensions for text-embedding-3-small)
 * 3. Creates HNSW index for efficient similarity search
 *
 * The embedding column stores OpenAI text-embedding-3-small vectors.
 * HNSW index provides fast approximate nearest neighbor search.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Enable pgvector extension
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS vector;
  `)

  // Add embedding column to products table
  // text-embedding-3-small produces 1536-dimensional vectors
  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
  `)

  // Add metadata for tracking embedding state
  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "embedding_model" varchar DEFAULT NULL;
  `)

  await db.execute(sql`
    ALTER TABLE "products"
    ADD COLUMN IF NOT EXISTS "embedding_updated_at" timestamp(3) with time zone DEFAULT NULL;
  `)

  // Create HNSW index for fast similarity search
  // HNSW is faster than IVFFlat for most use cases and doesn't require training
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "idx_products_embedding_hnsw"
    ON "products"
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
  `)

  console.log('[Migration] pgvector enabled with HNSW index for semantic search')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop the index first
  await db.execute(sql`
    DROP INDEX IF EXISTS "idx_products_embedding_hnsw";
  `)

  // Drop the embedding columns
  await db.execute(sql`
    ALTER TABLE "products" DROP COLUMN IF EXISTS "embedding";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "embedding_model";
    ALTER TABLE "products" DROP COLUMN IF EXISTS "embedding_updated_at";
  `)

  // Note: We don't drop the pgvector extension as other tables might use it
  console.log('[Migration] Removed embedding columns from products table')
}
