import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    // Create the enum type for video_type
    await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_videos_video_type" AS ENUM('short', 'longform');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)

    // Add video_type column to videos table
    await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "videos" ADD COLUMN "video_type" "enum_videos_video_type" DEFAULT 'longform';
    EXCEPTION
      WHEN duplicate_column THEN null;
    END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`ALTER TABLE "videos" DROP COLUMN IF EXISTS "video_type"`)
    await db.execute(sql`DROP TYPE IF EXISTS "enum_videos_video_type"`)
}
