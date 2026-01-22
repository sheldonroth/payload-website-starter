/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration: Update verdict values from 'avoid' to 'flagged'
 *
 * LEGAL FRAMEWORK COMPLIANCE:
 * Per THE_PRODUCT_REPORT_LEGAL_FRAMEWORK.md Section 4.1, the term "avoid"
 * is a prohibited imperative command (Category B) that could constitute
 * tortious interference.
 *
 * This migration updates all existing product verdicts from 'avoid' to 'flagged'
 * to comply with the Weather Report Doctrine language standards.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Migrating verdict values: avoid → flagged')

    // Step 1: Add 'flagged' to the enum type
    await db.execute(sql`ALTER TYPE "enum_products_verdict" ADD VALUE IF NOT EXISTS 'flagged'`)
    await db.execute(sql`ALTER TYPE "enum_products_auto_verdict" ADD VALUE IF NOT EXISTS 'flagged'`)
    await db.execute(sql`ALTER TYPE "enum_verdict_rules_ingredient_verdict_condition" ADD VALUE IF NOT EXISTS 'flagged'`)
    await db.execute(sql`ALTER TYPE "enum_verdict_rules_action" ADD VALUE IF NOT EXISTS 'set_flagged'`)

    // Step 2: Update products table
    await db.execute(sql`UPDATE products SET verdict = 'flagged' WHERE verdict = 'avoid'`)
    await db.execute(sql`UPDATE products SET auto_verdict = 'flagged' WHERE auto_verdict = 'avoid'`)

    // Step 3: Update verdict_rules table for ingredient conditions
    await db.execute(sql`UPDATE verdict_rules SET ingredient_verdict_condition = 'flagged' WHERE ingredient_verdict_condition = 'avoid'`)

    // Step 4: Update verdict_rules table for actions
    await db.execute(sql`UPDATE verdict_rules SET action = 'set_flagged' WHERE action = 'set_avoid'`)

    console.log('[Migration] Verdict values migrated successfully')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Rolling back verdict values: flagged → avoid')

    // Note: Cannot remove enum values in PostgreSQL, only update the data back
    // Revert products table
    await db.execute(sql`UPDATE products SET verdict = 'avoid' WHERE verdict = 'flagged'`)
    await db.execute(sql`UPDATE products SET auto_verdict = 'avoid' WHERE auto_verdict = 'flagged'`)

    // Revert verdict_rules table
    await db.execute(sql`UPDATE verdict_rules SET ingredient_verdict_condition = 'avoid' WHERE ingredient_verdict_condition = 'flagged'`)
    await db.execute(sql`UPDATE verdict_rules SET action = 'set_avoid' WHERE action = 'set_flagged'`)

    console.log('[Migration] Verdict values rolled back successfully')
}
