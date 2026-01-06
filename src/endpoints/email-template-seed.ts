/**
 * Email Template Seed Data
 * 
 * Pre-populated email templates for all sequences.
 * Run this to seed the CMS with the email content from the audit.
 */

import { Endpoint } from 'payload';

export const emailTemplateSeedHandler = async (req: any) => {
    const payload = req.payload;

    // Check if user is authenticated
    if (!req.user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = [
        // ============================================
        // WEEK 1: VALUE DISCOVERY
        // ============================================
        {
            sequence: 'week1_value',
            dayInSequence: 0,
            subject: 'Welcome to the truth 🔬',
            preheader: 'You just got access to something most people will never see.',
            headline: 'Welcome to The Product Report',
            body: {
                root: {
                    type: 'root',
                    children: [
                        {
                            type: 'paragraph',
                            children: [{
                                type: 'text', text: 'You just joined a community of people who refuse to be lied to about what's in their products.' }],
            },
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'Here's what makes us different: We don't read labels. We vaporize products in a mass spectrometer to find what brands hide.' }],
                            },
                            {
                                type: 'paragraph',
                                children: [{
                                    type: 'text', text: 'Ready to see what's really in your products?' }],
            },
                                ],
                            },
      },
                        ctaText: 'Scan Your First Product',
                        ctaUrl: 'theproductreport://scan',
                        status: 'active',
    },
    {
            sequence: 'week1_value',
            dayInSequence: 1,
            subject: 'How we test: Behind the lab 🧪',
            preheader: 'Ever wonder how we find what's hidden?',
      headline: 'Behind the Lab',
            body: {
                root: {
                    type: 'root',
                    children: [
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: 'Most "ingredient apps" just read labels. We do something different.' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{
                                type: 'text', text: 'We use mass spectrometry — the same technology forensic labs use — to find ingredients that don't appear on labels.' }],
            },
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'That's how we've found hidden ingredients in products marketed as "clean" and "natural."' }],
                            },
                            ],
                        },
      },
                ctaText: 'See Our Methodology',
                ctaUrl: 'https://theproductreport.org/methodology',
                status: 'active',
            },
    {
            sequence: 'week1_value',
            dayInSequence: 3,
            subject: 'What we found this week 🔍',
            preheader: 'Some interesting discoveries from the lab',
            headline: 'This Week in the Lab',
            body: {
                root: {
                    type: 'root',
                    children: [
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: 'Every week, we test products and share what we find. Here are some highlights:' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '• {{recent_test_1}}' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '• {{recent_test_2}}' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '• {{recent_test_3}}' }],
                        },
                    ],
                },
            },
            ctaText: 'Explore Discoveries',
            ctaUrl: 'theproductreport://discover',
            status: 'active',
        },
        {
            sequence: 'week1_value',
            dayInSequence: 5,
            subject: 'You've discovered {{ scan_count }} products so far 🎉',
preheader: 'Here's what you've learned',
    headline: 'Your Discovery Recap',
        body: {
    root: {
        type: 'root',
            children: [
                {
                    type: 'paragraph',
                    children: [{ type: 'text', text: 'In just 5 days, you've scanned {{ scan_count }} products.' }],
            },
    {
        type: 'paragraph',
            children: [{ type: 'text', text: '{{if_avoided}}You've learned about {{ avoid_count }} products we don't recommend — that's knowledge that protects you.{ {/if_avoided } } ' }],
},
{
    type: 'paragraph',
        children: [{ type: 'text', text: 'Keep exploring. The more you scan, the more you know.' }],
            },
          ],
        },
      },
ctaText: 'Keep Exploring',
    ctaUrl: 'theproductreport://home',
        status: 'active',
    },
{
    sequence: 'week1_value',
        dayInSequence: 7,
            subject: 'Your first-week recap 📊',
                preheader: 'A summary of your journey so far',
                    headline: 'Your Week 1 Report',
                        body: {
        root: {
            type: 'root',
                children: [
                    {
                        type: 'paragraph',
                        children: [{
                            type: 'text', text: 'You've been with us for a week now.Here's what you've discovered: ' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '📱 Products scanned: {{scan_count}}' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '✅ Products we recommend: {{recommended_count}}' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '❌ Products to avoid: {{avoid_count}}' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: 'Next up: Your weekly digest every Tuesday with new test results.' }],
                        },
                        ],
                    },
      },
        ctaText: 'See Your Full Report',
            ctaUrl: 'theproductreport://profile',
                status: 'active',
    },

    // ============================================
    // WEEKLY DIGEST
    // ============================================
    {
        sequence: 'weekly_digest',
            subject: '🧪 This week: {{test_count}} new tests',
                preheader: 'What we found in the lab this week',
                    headline: 'What We Tested This Week',
                        body: {
            root: {
                type: 'root',
                    children: [
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '{{weekly_test_summary}}' }],
                        },
                        {
                            type: 'heading',
                            tag: 'h3',
                            children: [{ type: 'text', text: 'The One That Surprised Us' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{ type: 'text', text: '{{surprise_story}}' }],
                        },
                        {
                            type: 'heading',
                            tag: 'h3',
                            children: [{ type: 'text', text: 'Quick Stat' }],
                        },
                        {
                            type: 'paragraph',
                            children: [{
                                type: 'text', text: 'This week, our community avoided {{community_avoid_count}} products we don't recommend.' }],
            },
                            ],
                        },
      },
            ctaText: 'Open the App',
                ctaUrl: 'theproductreport://home',
                    status: 'active',
    },

        // ============================================
        // WIN-BACK SEQUENCE
        // ============================================
        {
            sequence: 'winback',
                dayInSequence: 14,
                    subject: 'A lot has changed since you left',
                        preheader: 'We've been busy in the lab',
            headline: 'We've Tested { { new_test_count } } Products Since You Left',
            body: {
                root: {
                    type: 'root',
                        children: [
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'Hey {{first_name}},' }],
                            },
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'It's been a couple weeks since you opened the app.In that time, we've tested {{new_test_count}} new products.' }],
                            },
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'Some of them might be products you use.' }],
                            },
                        ],
        },
            },
            ctaText: 'See What's New',
            ctaUrl: 'theproductreport://discover',
                status: 'active',
    },
        {
            sequence: 'winback',
                dayInSequence: 30,
                    subject: 'We just re-tested {{product_from_history}}',
                        preheader: 'The results might interest you',
                            headline: 'Update on a Product You Scanned',
                                body: {
                root: {
                    type: 'root',
                        children: [
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'Remember {{product_from_history}}?' }],
                            },
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'We re-tested it recently. The results are interesting.' }],
                            },
                        ],
        },
            },
            ctaText: 'See Updated Results',
                ctaUrl: 'theproductreport://product/{{product_id}}',
                    status: 'active',
    },

        // ============================================
        // FOMO TRIGGERS
        // ============================================
        {
            sequence: 'fomo_trigger',
                triggerEvent: 'product_retested',
                    subject: 'Update: {{product_name}} results changed',
                        preheader: 'We re-tested a product you scanned',
                            headline: 'Product Update',
                                body: {
                root: {
                    type: 'root',
                        children: [
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'We re-tested {{product_name}} and found something different.' }],
                            },
                        ],
        },
            },
            ctaText: 'See Updated Report',
                ctaUrl: 'theproductreport://product/{{product_id}}',
                    status: 'active',
    },
        {
            sequence: 'fomo_trigger',
                triggerEvent: 'badge_unlocked',
                    subject: '🏅 You earned a new badge!',
                        preheader: 'Congratulations on your achievement',
                            headline: 'New Badge Unlocked: {{badge_name}}',
                                body: {
                root: {
                    type: 'root',
                        children: [
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: 'Congratulations! You just earned the {{badge_name}} badge.' }],
                            },
                            {
                                type: 'paragraph',
                                children: [{ type: 'text', text: '{{badge_description}}' }],
                            },
                        ],
        },
            },
            ctaText: 'View Your Badges',
                ctaUrl: 'theproductreport://badges',
                    status: 'active',
    },
        {
            sequence: 'fomo_trigger',
                triggerEvent: 'year_in_clean_ready',
                    subject: '🎁 Your Year in Clean is ready',
                        preheader: 'See your personalized annual report',
                            headline: 'Your 2025 Year in Clean',
                                body: {
                root: {
                    type: 'root',
                        children: [
                            {
                                type: 'paragraph',
                                children: [{
                                    type: 'text', text: 'It's that time of year! Your personalized Year in Clean report is ready.' }],
            },
                                {
                                    type: 'paragraph',
                                    children: [{ type: 'text', text: 'See how many products you scanned, which ones you avoided, and your clean shopping tier.' }],
                                },
                                ],
                            },
      },
                ctaText: 'See Your Year in Clean',
                    ctaUrl: 'theproductreport://year-in-clean',
                        status: 'active',
    },
  ];

            // Create all templates
            let created = 0;
            let skipped = 0;

            for (const template of templates) {
                try {
                    // Check if template already exists
                    const existing = await payload.find({
                        collection: 'email-templates',
                        where: {
                            and: [
                                { sequence: { equals: template.sequence } },
                                { dayInSequence: { equals: template.dayInSequence || 0 } },
                            ],
                        },
                        limit: 1,
                    });

                    if (existing.docs.length > 0) {
                        skipped++;
                        continue;
                    }

                    await payload.create({
                        collection: 'email-templates',
                        data: template,
                    });
                    created++;
                } catch (error) {
                    console.error(`Failed to create template: ${template.subject}`, error);
                }
            }

            return Response.json({
                success: true,
                created,
                skipped,
                total: templates.length,
                message: `Created ${created} templates, skipped ${skipped} existing`,
            });
        };

        export default emailTemplateSeedHandler;
