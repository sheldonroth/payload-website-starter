/**
 * Database Migration
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    // Add video_url column to videos table
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "videos" ADD COLUMN "video_url" varchar;
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "video_url"`)
}
