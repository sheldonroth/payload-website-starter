# Database Migrations Guide

This document describes best practices for creating and managing database migrations in the Payload CMS.

## Overview

Migrations run automatically on every build:
```bash
pnpm build  # Runs: payload migrate && next build
```

All migrations are stored in `/src/migrations/` and tracked in the `payload_migrations` database table.

---

## Migration Types

### 1. Schema Migrations (Payload-Generated)
Created when you add/modify collections or fields.

```bash
pnpm payload migrate:create add_new_field
```

These are safe because Payload generates the correct SQL.

### 2. Performance Migrations (Manual)
Adding indexes, constraints, or optimizations.

**⚠️ These require defensive SQL** because tables may not exist in all environments.

### 3. Data Migrations (Manual)
Backfilling data, transforming values, or cleaning up.

**Must be idempotent** — running twice should produce the same result.

---

## Defensive SQL Patterns

### Always Use These Patterns

#### Creating Indexes
```typescript
import { sql } from '@payloadcms/db-vercel-postgres'
import { createIndexIfTableExists } from '../utilities/migration-utils'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ✅ GOOD: Safe pattern with table existence check
  await createIndexIfTableExists(
    db,
    'products',
    'CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand)',
    'idx_products_brand'
  )
  
  // ❌ BAD: Will fail if table doesn't exist
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand)
  `)
}
```

#### Adding Columns
```typescript
// ✅ GOOD: Check column existence first
await db.execute(sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'new_field'
    ) THEN
      ALTER TABLE products ADD COLUMN new_field TEXT;
    END IF;
  END $$;
`)
```

#### Dropping Tables/Columns
```typescript
// ✅ GOOD: IF EXISTS handles missing objects
await db.execute(sql`
  DROP INDEX IF EXISTS "idx_products_brand";
  DROP TABLE IF EXISTS "temp_table";
  ALTER TABLE products DROP COLUMN IF EXISTS "deprecated_field";
`)
```

---

## Migration Utilities

Import from `/src/utilities/migration-utils.ts`:

```typescript
import { 
  createIndexIfTableExists,
  dropIndexIfExists,
  tableExists,
  columnExists,
  safeExecute
} from '../utilities/migration-utils'
```

### `createIndexIfTableExists(db, table, indexSql, indexName)`
Creates an index only if the table exists. Logs a message if skipped.

### `tableExists(db, tableName)`
Returns `true` if the table exists in the database.

### `columnExists(db, tableName, columnName)`
Returns `true` if the column exists on the table.

### `safeExecute(db, sql, description)`
Wraps SQL execution in try-catch, logs errors without failing the migration.

---

## Common Pitfalls

### 1. Assuming Tables Exist
**Problem:** Index migration fails because a table was created by a later migration.
**Solution:** Always check table existence before creating indexes.

### 2. Non-Idempotent Migrations
**Problem:** Running a migration twice causes errors.
**Solution:** Use `IF NOT EXISTS`, `IF EXISTS`, and check for existing data.

### 3. Environment Mismatch
**Problem:** Migration works locally but fails in production.
**Solution:** Test migrations against a fresh database copy.

### 4. Missing Down Migration
**Problem:** Can't rollback changes.
**Solution:** Always implement both `up()` and `down()` functions.

---

## Testing Migrations

### Before Deploying
1. Run migrations against a fresh database
2. Check for errors in the console
3. Verify indexes were created: `\di` in psql

### After Deploying
1. Check Vercel build logs for migration output
2. Verify in Neon console that changes were applied
3. Check `payload_migrations` table for migration status

---

## Troubleshooting

### "relation does not exist"
The table hasn't been created yet. Use `createIndexIfTableExists()`.

### "index already exists"
Add `IF NOT EXISTS` to your CREATE INDEX statement.

### "column does not exist"
The field was added in a later migration. Check migration ordering.

### Migration stuck
1. Check `payload_migrations` table for the migration name
2. If partially run, fix the data and mark as complete:
   ```sql
   UPDATE payload_migrations SET batch = -1 WHERE name = 'migration_name';
   ```

---

## File Naming Convention

```
YYYYMMDD_HHMMSS_description.ts
```

Examples:
- `20260107_110000_add_performance_indexes.ts`
- `20260108_000000_backfill_slugs.ts`
- `20260109_150000_remove_deprecated_fields.ts`

---

## Quick Reference

| Pattern | Use Case |
|---------|----------|
| `IF NOT EXISTS` | Creating tables, indexes, columns |
| `IF EXISTS` | Dropping tables, indexes, columns |
| `DO $$ ... END $$;` | Conditional logic in SQL |
| `information_schema` | Checking table/column existence |
| `safeExecute()` | Non-critical operations that can fail |
