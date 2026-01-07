/**
 * Migration Utilities
 *
 * Helper functions for creating safe, defensive database migrations.
 * These utilities prevent common migration failures caused by:
 * - Tables not existing (different environments)
 * - Columns not existing (migration ordering issues)
 * - Indexes already existing (re-running migrations)
 *
 * @see /MIGRATIONS.md for full documentation
 */

import { sql } from '@payloadcms/db-vercel-postgres'

// Type for the database instance from Payload migrations
type MigrationDB = {
    execute: (query: ReturnType<typeof sql> | ReturnType<typeof sql.raw>) => Promise<unknown>
}

/**
 * Check if a table exists in the database
 *
 * @param db - Database instance from migration args
 * @param tableName - Name of the table to check
 * @returns Promise<boolean> - True if table exists
 *
 * @example
 * if (await tableExists(db, 'contributor_profiles')) {
 *   await db.execute(sql`CREATE INDEX ...`)
 * }
 */
export async function tableExists(db: MigrationDB, tableName: string): Promise<boolean> {
    try {
        const result = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = '${tableName}'
      ) as exists
    `))
        // Result structure varies, check common patterns
        const rows = (result as any)?.rows || (result as any)
        return rows?.[0]?.exists === true || rows?.[0]?.exists === 't'
    } catch (error) {
        console.log(`[Migration] Error checking table ${tableName}:`, error)
        return false
    }
}

/**
 * Check if a column exists on a table
 *
 * @param db - Database instance from migration args
 * @param tableName - Name of the table
 * @param columnName - Name of the column to check
 * @returns Promise<boolean> - True if column exists
 *
 * @example
 * if (await columnExists(db, 'products', 'new_field')) {
 *   console.log('Column already exists, skipping')
 * }
 */
export async function columnExists(
    db: MigrationDB,
    tableName: string,
    columnName: string
): Promise<boolean> {
    try {
        const result = await db.execute(sql.raw(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '${tableName}' AND column_name = '${columnName}'
      ) as exists
    `))
        const rows = (result as any)?.rows || (result as any)
        return rows?.[0]?.exists === true || rows?.[0]?.exists === 't'
    } catch (error) {
        console.log(`[Migration] Error checking column ${tableName}.${columnName}:`, error)
        return false
    }
}

/**
 * Create an index only if the target table exists
 *
 * This is the safest pattern for adding performance indexes, as it prevents
 * failures when tables haven't been created yet (e.g., in fresh environments
 * or when migration order differs from table creation order).
 *
 * @param db - Database instance from migration args
 * @param tableName - Name of the table the index is on
 * @param indexSql - The CREATE INDEX SQL statement (should include IF NOT EXISTS)
 * @param indexName - Name of the index (for logging)
 *
 * @example
 * await createIndexIfTableExists(
 *   db,
 *   'products',
 *   'CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand)',
 *   'idx_products_brand'
 * )
 */
export async function createIndexIfTableExists(
    db: MigrationDB,
    tableName: string,
    indexSql: string,
    indexName: string
): Promise<void> {
    try {
        await db.execute(sql.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}') THEN
          EXECUTE '${indexSql.replace(/'/g, "''")}';
        ELSE
          RAISE NOTICE 'Table ${tableName} does not exist, skipping index ${indexName}';
        END IF;
      END $$;
    `))
        console.log(`[Migration] Processed index ${indexName}`)
    } catch (error) {
        console.log(`[Migration] Skipping ${indexName}: ${(error as Error).message}`)
    }
}

/**
 * Drop an index if it exists (safe for all environments)
 *
 * @param db - Database instance from migration args
 * @param indexName - Name of the index to drop
 *
 * @example
 * await dropIndexIfExists(db, 'idx_products_brand')
 */
export async function dropIndexIfExists(db: MigrationDB, indexName: string): Promise<void> {
    try {
        await db.execute(sql.raw(`DROP INDEX IF EXISTS "${indexName}"`))
        console.log(`[Migration] Dropped index ${indexName} (if existed)`)
    } catch (error) {
        console.log(`[Migration] Error dropping ${indexName}: ${(error as Error).message}`)
    }
}

/**
 * Execute SQL with error handling - won't fail the migration on error
 *
 * Use this for non-critical operations where failure is acceptable
 * (e.g., cleanup operations, optional indexes).
 *
 * @param db - Database instance from migration args
 * @param query - SQL query to execute
 * @param description - Human-readable description for logging
 * @returns Promise<boolean> - True if successful, false if failed
 *
 * @example
 * const success = await safeExecute(
 *   db,
 *   'DROP TABLE IF EXISTS temp_analytics',
 *   'Drop temporary analytics table'
 * )
 */
export async function safeExecute(
    db: MigrationDB,
    query: string,
    description: string
): Promise<boolean> {
    try {
        await db.execute(sql.raw(query))
        console.log(`[Migration] ✓ ${description}`)
        return true
    } catch (error) {
        console.log(`[Migration] ✗ ${description}: ${(error as Error).message}`)
        return false
    }
}

/**
 * Add a column if it doesn't exist
 *
 * @param db - Database instance from migration args
 * @param tableName - Name of the table
 * @param columnName - Name of the column to add
 * @param columnDefinition - SQL column definition (e.g., 'TEXT NOT NULL DEFAULT ""')
 *
 * @example
 * await addColumnIfNotExists(db, 'products', 'slug', 'TEXT UNIQUE')
 */
export async function addColumnIfNotExists(
    db: MigrationDB,
    tableName: string,
    columnName: string,
    columnDefinition: string
): Promise<void> {
    try {
        await db.execute(sql.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = '${tableName}' AND column_name = '${columnName}'
        ) THEN
          ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnDefinition};
        END IF;
      END $$;
    `))
        console.log(`[Migration] Processed column ${tableName}.${columnName}`)
    } catch (error) {
        console.log(`[Migration] Error adding ${tableName}.${columnName}: ${(error as Error).message}`)
    }
}

/**
 * Drop a column if it exists
 *
 * @param db - Database instance from migration args
 * @param tableName - Name of the table
 * @param columnName - Name of the column to drop
 *
 * @example
 * await dropColumnIfExists(db, 'products', 'deprecated_field')
 */
export async function dropColumnIfExists(
    db: MigrationDB,
    tableName: string,
    columnName: string
): Promise<void> {
    try {
        await db.execute(sql.raw(`
      ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}"
    `))
        console.log(`[Migration] Dropped column ${tableName}.${columnName} (if existed)`)
    } catch (error) {
        console.log(`[Migration] Error dropping ${tableName}.${columnName}: ${(error as Error).message}`)
    }
}
