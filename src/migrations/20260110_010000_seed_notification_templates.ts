/**
 * Database Migration - Seed Notification Templates
 * @see /MIGRATIONS.md for defensive SQL patterns and utilities
 */
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Seed initial notification templates with sample data
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    console.log('[Migration] Seeding notification templates...')

    // Helper to insert a template and return its ID
    const insertTemplate = async (template: {
        name: string
        type: string
        description: string
        isActive: boolean
        experimentName?: string
        scheduleEnabled: boolean
        scheduleHour?: number
        scheduleMinute: number
        scheduleTimezone: string
        scheduleRepeats: boolean
        scheduleCooldownHours: number
        targetingMinDaysSinceInstall?: number
        targetingRequiresStreak: boolean
        targetingRequiresSubscription: boolean
        targetingExcludeSubscribers: boolean
    }) => {
        const result = await db.execute(sql`
            INSERT INTO "notification_templates" (
                "name",
                "type",
                "description",
                "is_active",
                "experiment_name",
                "schedule_enabled",
                "schedule_hour",
                "schedule_minute",
                "schedule_timezone",
                "schedule_repeats",
                "schedule_cooldown_hours",
                "targeting_min_days_since_install",
                "targeting_requires_streak",
                "targeting_requires_subscription",
                "targeting_exclude_subscribers",
                "version",
                "updated_at",
                "created_at"
            ) VALUES (
                ${template.name},
                ${template.type}::"enum_notification_templates_type",
                ${template.description},
                ${template.isActive},
                ${template.experimentName || null},
                ${template.scheduleEnabled},
                ${template.scheduleHour ?? null},
                ${template.scheduleMinute},
                ${template.scheduleTimezone}::"enum_notification_templates_schedule_timezone",
                ${template.scheduleRepeats},
                ${template.scheduleCooldownHours},
                ${template.targetingMinDaysSinceInstall ?? null},
                ${template.targetingRequiresStreak},
                ${template.targetingRequiresSubscription},
                ${template.targetingExcludeSubscribers},
                1,
                NOW(),
                NOW()
            )
            RETURNING "id"
        `)
        return (result as unknown as { rows: Array<{ id: number }> }).rows[0].id
    }

    // 1. Daily Discovery Template
    const dailyDiscoveryId = await insertTemplate({
        name: 'Daily Discovery Reminder',
        type: 'daily_discovery',
        description: 'Encourages users to discover new products each day',
        isActive: true,
        experimentName: 'notification_daily_discovery_v1',
        scheduleEnabled: true,
        scheduleHour: 10,
        scheduleMinute: 0,
        scheduleTimezone: 'user_local',
        scheduleRepeats: true,
        scheduleCooldownHours: 24,
        targetingMinDaysSinceInstall: 1,
        targetingRequiresStreak: false,
        targetingRequiresSubscription: false,
        targetingExcludeSubscribers: false,
    })

    // Insert variants for Daily Discovery
    await db.execute(sql`
        INSERT INTO "notification_templates_variants" ("_order", "_parent_id", "variant_id", "title", "body", "emoji", "weight", "action")
        VALUES
            (1, ${dailyDiscoveryId}, 'control', 'Time to discover!', 'Your personalized product recommendations are waiting', NULL, 1, 'open_discovery'),
            (2, ${dailyDiscoveryId}, 'emoji_test', 'Ready to discover? {{emoji}}', 'We found products you might love based on your preferences', '✨', 1, 'open_discovery'),
            (3, ${dailyDiscoveryId}, 'personal', 'Hey {{userName}}!', 'Check out today''s curated picks just for you', NULL, 1, 'open_discovery')
    `)

    console.log('[Migration] Created Daily Discovery template with 3 variants')

    // 2. Streak Reminder Template
    const streakReminderId = await insertTemplate({
        name: 'Streak Reminder',
        type: 'streak_reminder',
        description: 'Reminds users to maintain their scanning streak',
        isActive: true,
        experimentName: 'notification_streak_v1',
        scheduleEnabled: true,
        scheduleHour: 20,
        scheduleMinute: 0,
        scheduleTimezone: 'user_local',
        scheduleRepeats: true,
        scheduleCooldownHours: 20,
        targetingMinDaysSinceInstall: 3,
        targetingRequiresStreak: true,
        targetingRequiresSubscription: false,
        targetingExcludeSubscribers: false,
    })

    // Insert variants for Streak Reminder
    await db.execute(sql`
        INSERT INTO "notification_templates_variants" ("_order", "_parent_id", "variant_id", "title", "body", "emoji", "weight", "action")
        VALUES
            (1, ${streakReminderId}, 'control', 'Keep your streak alive!', 'You''re on a {{streakCount}}-day streak. Scan a product to continue!', '🔥', 1, 'open_scanner'),
            (2, ${streakReminderId}, 'urgent', 'Your streak is at risk!', '{{streakCount}} days could be lost. Just one scan keeps it going!', '⚠️', 1, 'open_scanner')
    `)

    console.log('[Migration] Created Streak Reminder template with 2 variants')

    // 3. Badge Unlock Template
    const badgeUnlockId = await insertTemplate({
        name: 'Badge Unlock Celebration',
        type: 'badge_unlock',
        description: 'Celebrates when users earn new badges',
        isActive: true,
        scheduleEnabled: false,
        scheduleMinute: 0,
        scheduleTimezone: 'user_local',
        scheduleRepeats: false,
        scheduleCooldownHours: 0,
        targetingRequiresStreak: false,
        targetingRequiresSubscription: false,
        targetingExcludeSubscribers: false,
    })

    // Insert variants for Badge Unlock
    await db.execute(sql`
        INSERT INTO "notification_templates_variants" ("_order", "_parent_id", "variant_id", "title", "body", "emoji", "weight", "action", "action_data")
        VALUES
            (1, ${badgeUnlockId}, 'control', '{{badgeEmoji}} Badge Unlocked!', 'You earned the {{badgeName}} badge! Tap to see your collection.', NULL, 1, 'view_badge', '{"screen": "badges"}')
    `)

    console.log('[Migration] Created Badge Unlock template with 1 variant')

    // 4. Re-engagement Template
    const reEngagementId = await insertTemplate({
        name: 'Re-engagement - Inactive Users',
        type: 're_engagement',
        description: 'Brings back users who have not used the app recently',
        isActive: true,
        experimentName: 'notification_reengagement_v1',
        scheduleEnabled: true,
        scheduleHour: 14,
        scheduleMinute: 0,
        scheduleTimezone: 'user_local',
        scheduleRepeats: true,
        scheduleCooldownHours: 72,
        targetingRequiresStreak: false,
        targetingRequiresSubscription: false,
        targetingExcludeSubscribers: false,
    })

    // Insert variants for Re-engagement
    await db.execute(sql`
        INSERT INTO "notification_templates_variants" ("_order", "_parent_id", "variant_id", "title", "body", "emoji", "weight", "action")
        VALUES
            (1, ${reEngagementId}, 'control', 'We miss you!', 'Come back and discover new products tailored to your preferences', '👋', 1, 'open_discovery'),
            (2, ${reEngagementId}, 'curiosity', 'See what''s new', 'We''ve added new features since your last visit!', '🆕', 1, 'open_discovery')
    `)

    // Add targeting segment for churning users
    await db.execute(sql`
        INSERT INTO "notification_templates_targeting_segments" ("order", "parent_id", "value")
        VALUES (1, ${reEngagementId}, 'churning')
    `)

    console.log('[Migration] Created Re-engagement template with 2 variants')

    // 5. Feature Announcement Template
    const featureAnnouncementId = await insertTemplate({
        name: 'New Feature Announcement',
        type: 'feature_announcement',
        description: 'Announces new app features to all users',
        isActive: false,
        scheduleEnabled: false,
        scheduleMinute: 0,
        scheduleTimezone: 'UTC',
        scheduleRepeats: false,
        scheduleCooldownHours: 0,
        targetingRequiresStreak: false,
        targetingRequiresSubscription: false,
        targetingExcludeSubscribers: false,
    })

    // Insert variants for Feature Announcement
    await db.execute(sql`
        INSERT INTO "notification_templates_variants" ("_order", "_parent_id", "variant_id", "title", "body", "emoji", "weight", "action")
        VALUES
            (1, ${featureAnnouncementId}, 'control', 'New Feature Alert!', 'Check out the latest addition to your favorite app', '🚀', 1, 'open_discovery')
    `)

    console.log('[Migration] Created Feature Announcement template (inactive)')

    console.log('[Migration] Notification templates seeding completed!')
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
    console.log('[Migration] Removing seeded notification templates...')

    // Delete all seeded templates - the cascading foreign keys will clean up variants and junction tables
    await db.execute(sql`
        DELETE FROM "notification_templates"
        WHERE "name" IN (
            'Daily Discovery Reminder',
            'Streak Reminder',
            'Badge Unlock Celebration',
            'Re-engagement - Inactive Users',
            'New Feature Announcement'
        )
    `)

    console.log('[Migration] Seeded notification templates removed')
}
