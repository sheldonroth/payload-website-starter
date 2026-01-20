import { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

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
export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
    console.log('🔄 Migrating verdict values: avoid → flagged')

    // Update products table
    await payload.db.drizzle.execute({
        sql: `UPDATE products SET verdict = 'flagged' WHERE verdict = 'avoid'`,
    })

    await payload.db.drizzle.execute({
        sql: `UPDATE products SET auto_verdict = 'flagged' WHERE auto_verdict = 'avoid'`,
    })

    // Update verdict_rules table for ingredient conditions
    await payload.db.drizzle.execute({
        sql: `UPDATE verdict_rules SET ingredient_verdict_condition = 'flagged' WHERE ingredient_verdict_condition = 'avoid'`,
    })

    // Update verdict_rules table for actions
    await payload.db.drizzle.execute({
        sql: `UPDATE verdict_rules SET action = 'set_flagged' WHERE action = 'set_avoid'`,
    })

    console.log('✅ Verdict values migrated successfully')
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
    console.log('🔄 Rolling back verdict values: flagged → avoid')

    // Revert products table
    await payload.db.drizzle.execute({
        sql: `UPDATE products SET verdict = 'avoid' WHERE verdict = 'flagged'`,
    })

    await payload.db.drizzle.execute({
        sql: `UPDATE products SET auto_verdict = 'avoid' WHERE auto_verdict = 'flagged'`,
    })

    // Revert verdict_rules table
    await payload.db.drizzle.execute({
        sql: `UPDATE verdict_rules SET ingredient_verdict_condition = 'avoid' WHERE ingredient_verdict_condition = 'flagged'`,
    })

    await payload.db.drizzle.execute({
        sql: `UPDATE verdict_rules SET action = 'set_avoid' WHERE action = 'set_flagged'`,
    })

    console.log('✅ Verdict values rolled back successfully')
}
