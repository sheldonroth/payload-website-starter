/**
 * Year in Clean Report Generator - Cron Job Endpoint
 * 
 * Generates annual "Year in Clean" reports for all subscribers.
 * Run annually on December 20th to give users reports before holidays.
 * 
 * Schedule: December 20th at 9:00 AM UTC
 * Vercel Cron: 0 9 20 12 *
 */

import { Endpoint } from 'payload';
import { getPayloadHMACClient } from '../lib/payload-utils';

interface UserScanStats {
    userId: string;
    email: string;
    totalScans: number;
    uniqueProducts: number;
    categories: string[];
    cleanProducts: number;
    dangerousProducts: number;
    topProduct: { name: string; score: number } | null;
    worstProduct: { name: string; score: number } | null;
    mostActiveMonth: string;
}

// Tier thresholds
const TIERS = {
    platinum: { minScans: 250, label: 'Clean Crusader', percentile: 'Top 5%' },
    gold: { minScans: 100, label: 'Clean Champion', percentile: 'Top 15%' },
    silver: { minScans: 25, label: 'Clean Conscious', percentile: 'Top 35%' },
    bronze: { minScans: 0, label: 'Clean Curious', percentile: '' },
};

function calculateTier(scanCount: number): keyof typeof TIERS {
    if (scanCount >= TIERS.platinum.minScans) return 'platinum';
    if (scanCount >= TIERS.gold.minScans) return 'gold';
    if (scanCount >= TIERS.silver.minScans) return 'silver';
    return 'bronze';
}

export const yearInCleanCron: Endpoint = {
    path: '/year-in-clean-cron',
    method: 'post',
    handler: async (req) => {
        try {
            // Verify cron secret (Vercel sends this)
            const authHeader = req.headers.get('authorization');
            const cronSecret = process.env.CRON_SECRET;

            if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
                return Response.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }

            const year = new Date().getFullYear();
            const payload = req.payload;

            // Get all scan events from this year
            // This queries the ScanEvents collection (you may need to create this)
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31, 23, 59, 59);

            // Get all device fingerprints (users)
            const deviceFingerprints = await payload.find({
                collection: 'device-fingerprints',
                limit: 10000,
                where: {
                    subscriptionStatus: { equals: 'active' },
                },
            });

            const reports: any[] = [];

            for (const device of deviceFingerprints.docs) {
                // Get scan history for this user from ProductViews or similar
                const scanHistory = await payload.find({
                    collection: 'product-views', // Adjust collection name
                    where: {
                        fingerprint: { equals: device.id },
                        createdAt: {
                            greater_than_equal: yearStart.toISOString(),
                            less_than_equal: yearEnd.toISOString(),
                        },
                    },
                    limit: 1000,
                });

                if (scanHistory.docs.length === 0) continue;

                const scans = scanHistory.docs;
                const uniqueProducts = new Set(scans.map((s: any) => s.product)).size;
                const categories = [...new Set(scans.map((s: any) => s.category || 'Unknown'))];

                // Count by score
                const cleanProducts = scans.filter((s: any) => (s.score || 50) >= 70).length;
                const dangerousProducts = scans.filter((s: any) => (s.score || 50) < 40).length;

                // Find most active month
                const monthCounts: Record<string, number> = {};
                scans.forEach((scan: any) => {
                    const date = new Date(scan.createdAt);
                    const month = date.toLocaleString('default', { month: 'long' });
                    monthCounts[month] = (monthCounts[month] || 0) + 1;
                });
                const mostActiveMonth = Object.entries(monthCounts)
                    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

                const tier = calculateTier(scans.length);
                const tierInfo = TIERS[tier];

                // Create or update Year in Clean report
                const report = {
                    fingerprint: device.id,
                    email: device.email,
                    year,
                    totalScans: scans.length,
                    uniqueProducts,
                    categories,
                    cleanProducts,
                    dangerousProducts,
                    estimatedMoneySaved: dangerousProducts * 15, // $15/product avg
                    tier,
                    tierLabel: tierInfo.label,
                    tierPercentile: tierInfo.percentile,
                    mostActiveMonth,
                    generatedAt: new Date().toISOString(),
                };

                // Store report (create YearInCleanReports collection if needed)
                try {
                    await payload.create({
                        collection: 'year-in-clean-reports',
                        data: report,
                    });
                    reports.push(report);
                } catch (e) {
                    console.error(`Failed to save report for ${device.id}:`, e);
                }
            }

            // Optionally trigger email/push notifications here

            return Response.json({
                success: true,
                year,
                reportsGenerated: reports.length,
                timestamp: new Date().toISOString(),
            });

        } catch (error) {
            console.error('[Year in Clean Cron] Error:', error);
            return Response.json(
                { error: 'Failed to generate reports', details: String(error) },
                { status: 500 }
            );
        }
    },
};

export default yearInCleanCron;
