import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-vercel-postgres'

/**
 * Migration: Fix push_tokens_product_subscriptions table
 *
 * The push_tokens collection has a productSubscriptions array field.
 * Payload expects this to be stored in a separate relation table, but
 * the database currently has it as a jsonb column.
 *
 * This migration:
 * 1. Creates the push_tokens_product_subscriptions table
 * 2. Migrates existing jsonb data to the new table
 * 3. Drops the old jsonb column
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('[Migration] Starting push_tokens array table fix...')

  // Check if the new table already exists
  const tableCheckResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'push_tokens_product_subscriptions'
    ) as exists;
  `)
  const tableExists = tableCheckResult.rows?.[0]?.exists ?? false

  if (tableExists) {
    console.log('[Migration] push_tokens_product_subscriptions table already exists, skipping creation')
  } else {
    // Create the relation table
    console.log('[Migration] Creating push_tokens_product_subscriptions table...')
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "push_tokens_product_subscriptions" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,
        "barcode" varchar,
        "subscribed_at" timestamp(3) with time zone,
        "notified" boolean DEFAULT false
      );
    `)

    // Add indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "push_tokens_product_subscriptions_order_idx" ON "push_tokens_product_subscriptions" USING btree ("_order");
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "push_tokens_product_subscriptions_parent_id_idx" ON "push_tokens_product_subscriptions" USING btree ("_parent_id");
    `)

    // Add foreign key
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE "push_tokens_product_subscriptions"
        ADD CONSTRAINT "push_tokens_product_subscriptions_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "push_tokens"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `)

    console.log('[Migration] push_tokens_product_subscriptions table created')
  }

  // Check if the old jsonb column exists
  const columnCheck = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'push_tokens'
      AND column_name = 'product_subscriptions'
    ) as exists;
  `)
  const columnExists = columnCheck.rows?.[0]?.exists ?? false

  if (columnExists) {
    // Migrate data from jsonb to relation table
    console.log('[Migration] Migrating existing data from jsonb to relation table...')

    // Get all push tokens with product_subscriptions data
    const pushTokens = await db.execute(sql`
      SELECT id, product_subscriptions
      FROM push_tokens
      WHERE product_subscriptions IS NOT NULL
      AND product_subscriptions != '[]'::jsonb
      AND product_subscriptions != 'null'::jsonb
    `)

    let migratedCount = 0
    for (const row of pushTokens.rows || []) {
      const parentId = row.id
      const subscriptions = row.product_subscriptions

      if (Array.isArray(subscriptions)) {
        for (let i = 0; i < subscriptions.length; i++) {
          const sub = subscriptions[i]
          const uuid = `${parentId}-${i}-${Date.now()}`

          await db.execute(sql.raw(`
            INSERT INTO push_tokens_product_subscriptions ("_order", "_parent_id", "id", "barcode", "subscribed_at", "notified")
            VALUES (${i}, ${parentId}, '${uuid}', ${sub.barcode ? `'${sub.barcode}'` : 'NULL'}, ${sub.subscribedAt ? `'${sub.subscribedAt}'` : 'NULL'}, ${sub.notified ? 'true' : 'false'})
            ON CONFLICT (id) DO NOTHING
          `))
          migratedCount++
        }
      }
    }
    console.log(`[Migration] Migrated ${migratedCount} subscription records`)

    // Drop the old jsonb column
    console.log('[Migration] Dropping old product_subscriptions jsonb column...')
    await db.execute(sql`
      ALTER TABLE push_tokens DROP COLUMN IF EXISTS product_subscriptions;
    `)
  }

  console.log('[Migration] push_tokens array table fix completed')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-add the jsonb column
  await db.execute(sql`
    ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS product_subscriptions jsonb DEFAULT '[]';
  `)

  // Migrate data back from relation table to jsonb
  await db.execute(sql`
    UPDATE push_tokens pt SET product_subscriptions = (
      SELECT COALESCE(json_agg(
        json_build_object(
          'barcode', ps.barcode,
          'subscribedAt', ps.subscribed_at,
          'notified', ps.notified
        ) ORDER BY ps._order
      ), '[]')
      FROM push_tokens_product_subscriptions ps
      WHERE ps._parent_id = pt.id
    );
  `)

  // Drop the relation table
  await db.execute(sql`
    DROP TABLE IF EXISTS push_tokens_product_subscriptions;
  `)
}
