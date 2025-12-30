import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Migration to fix typos in database:
 * 1. "Alchohol" → "Alcohol" (category name)
 * 2. "Nicotine Toothpics" → "Nicotine Toothpicks" (category name)
 * 3. Fix corresponding slugs
 * 4. Fix article with placeholder excerpt "excerpt here"
 */

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Fix "Alchohol" → "Alcohol" category
  await db.execute(sql`
    UPDATE "categories"
    SET "name" = 'Alcohol', "slug" = 'alcohol'
    WHERE "name" = 'Alchohol' OR "slug" = 'alchohol';
  `)

  // Fix "Nicotine Toothpics" → "Nicotine Toothpicks" category
  await db.execute(sql`
    UPDATE "categories"
    SET "name" = 'Nicotine Toothpicks', "slug" = 'nicotine-toothpicks'
    WHERE "name" = 'Nicotine Toothpics' OR "slug" = 'nicotine-toothpics';
  `)

  // Fix article with placeholder excerpt
  await db.execute(sql`
    UPDATE "articles"
    SET "excerpt" = 'An investigation into the hidden truth behind popular chocolate milk brands. Our lab tests reveal what companies don''t want you to know about heavy metals and contaminants in your favorite drinks.'
    WHERE "excerpt" ILIKE '%excerpt here%';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Revert to original typos (for rollback purposes)
  await db.execute(sql`
    UPDATE "categories"
    SET "name" = 'Alchohol', "slug" = 'alchohol'
    WHERE "name" = 'Alcohol' AND "slug" = 'alcohol';
  `)

  await db.execute(sql`
    UPDATE "categories"
    SET "name" = 'Nicotine Toothpics', "slug" = 'nicotine-toothpics'
    WHERE "name" = 'Nicotine Toothpicks' AND "slug" = 'nicotine-toothpicks';
  `)

  // Note: We don't revert article excerpt as placeholder text is invalid
}
