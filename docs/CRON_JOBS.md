# Cron Jobs Documentation

This document describes all scheduled background jobs that run on Vercel Cron.

## Overview

All cron jobs are defined in `vercel.json` and secured with the `CRON_SECRET` environment variable. Jobs are triggered by Vercel's scheduler and execute at the specified times (UTC).

## Job Schedule

| Job | Path | Schedule | Description |
|-----|------|----------|-------------|
| **Weekly Digest** | `/api/cron/weekly-digest` | Tuesdays 10:00 UTC | Compiles weekly product highlights |
| **Trending Products** | `/api/cron/trending` | Daily 06:00 UTC | Calculates trending products |
| **Recall Check** | `/api/cron/recall-check` | Daily 08:00 UTC | Checks FDA/CPSC recall feeds |
| **Regulatory Monitor** | `/api/cron/regulatory` | Mondays 07:00 UTC | Monitors regulatory changes |
| **Brand Trust Scores** | `/api/cron/brand-trust` | Sundays 09:00 UTC | Recalculates brand trust scores |
| **Calculate Archetypes** | `/api/cron/calculate-archetypes` | Daily 03:00 UTC | Updates product archetypes |
| **Trending Notifications** | `/api/cron/trending-notifications` | Every 6 hours | Sends push notifications for trending products |
| **Market Intelligence** | `/api/cron/market-intel` | Every 6 hours | Gathers market intelligence data |
| **Brand Analytics** | `/api/cron/brand-analytics` | Daily 03:00 UTC | Updates brand analytics dashboard |
| **Year in Clean** | `/api/year-in-clean-cron` | Dec 20 09:00 UTC | Generates annual user reports |
| **Email: Weekly Digest** | `/api/email-cron?job=weekly_digest` | Tuesdays 16:00 UTC | Sends weekly email digest |
| **Email: Week 1 Sequence** | `/api/email-cron?job=week1_sequence` | Daily 15:00 UTC | Onboarding email sequence |
| **Email: Winback** | `/api/email-cron?job=winback_sequence` | Daily 18:00 UTC | Re-engagement email sequence |
| **Generate Embeddings** | `/api/cron/generate-embeddings` | Hourly | Generates pgvector embeddings for semantic search |

## Job Details

### 1. Weekly Digest (`/api/cron/weekly-digest`)

**Schedule:** Tuesdays at 10:00 UTC
**Purpose:** Compiles the week's product discoveries, top scans, and featured content.

**Process:**
1. Aggregates top products scanned in the last week
2. Selects featured "Safe Swap" recommendations
3. Compiles new product additions
4. Stores digest data for email template consumption

---

### 2. Trending Products (`/api/cron/trending`)

**Schedule:** Daily at 06:00 UTC
**Purpose:** Calculates trending products based on scan velocity and engagement.

**Algorithm:**
- Scan velocity (scans in last 24h vs. 7-day average)
- Save rate (bookmarks / views)
- Share rate (shares / views)
- Recency weighting (newer products get boost)

**Output:** Updates `trending_score` field on Product collection.

---

### 3. Recall Check (`/api/cron/recall-check`)

**Schedule:** Daily at 08:00 UTC
**Purpose:** Monitors FDA and CPSC recall feeds for product safety alerts.

**Sources:**
- FDA OpenFDA API
- CPSC Recalls API

**Actions:**
1. Fetches new recalls from APIs
2. Matches against products in database (by name, brand, UPC)
3. Updates product `recall_status` field
4. Triggers push notification for affected users
5. Creates admin alert for review

---

### 4. Regulatory Monitor (`/api/cron/regulatory`)

**Schedule:** Mondays at 07:00 UTC
**Purpose:** Monitors regulatory changes affecting product ingredients.

**Sources:**
- EU SCCS opinions
- FDA warnings
- California Prop 65 updates

**Output:** Creates `RegulatoryChange` entries with AI-generated summaries.

---

### 5. Brand Trust Scores (`/api/cron/brand-trust`)

**Schedule:** Sundays at 09:00 UTC
**Purpose:** Recalculates brand-level trust scores.

**Factors:**
- Average product score across brand
- Recall history
- Ingredient transparency
- Formulation consistency
- Customer feedback sentiment

**Output:** Updates `trust_score` on Brand collection.

---

### 6. Calculate Archetypes (`/api/cron/calculate-archetypes`)

**Schedule:** Daily at 03:00 UTC
**Purpose:** Classifies products into archetypes for recommendations.

**Archetypes:**
- `best_value` - Best quality/price ratio
- `premium_pick` - Top-tier regardless of price
- `hidden_gem` - High quality, low visibility
- `budget_choice` - Good score, lowest price

**Algorithm:** See `src/utilities/archetype-calculator.ts`

---

### 7. Trending Notifications (`/api/cron/trending-notifications`)

**Schedule:** Every 6 hours
**Purpose:** Sends push notifications for newly trending products.

**Targeting:**
- Users who scanned similar products
- Users interested in the category
- Users following the brand

**Rate limit:** Max 3 trending notifications per user per day.

---

### 8. Market Intelligence (`/api/cron/market-intel`)

**Schedule:** Every 6 hours
**Purpose:** Gathers competitive intelligence for brand portal.

**Data collected:**
- Category trends
- Price movements
- New product launches
- Competitor activity

**Output:** Populates `MarketIntelligence` collection.

---

### 9. Brand Analytics (`/api/cron/brand-analytics`)

**Schedule:** Daily at 03:00 UTC
**Purpose:** Updates analytics dashboards for brand portal subscribers.

**Metrics:**
- Product scan counts
- Category rankings
- Consumer sentiment
- Market share estimates

**Output:** Populates `BrandAnalytics` collection.

---

### 10. Year in Clean (`/api/year-in-clean-cron`)

**Schedule:** December 20 at 09:00 UTC (annual)
**Purpose:** Generates personalized annual user reports.

**Includes:**
- Total products scanned
- Products avoided
- Estimated chemicals avoided
- Top categories explored
- Personal milestones

**Output:** Stores report data and triggers email.

---

### 11. Email Sequences (`/api/email-cron`)

**Schedule:** Multiple (see above)
**Purpose:** Automated email campaigns.

**Jobs:**
- `weekly_digest`: Weekly newsletter (Tuesdays 4 PM UTC)
- `week1_sequence`: Day 1-7 onboarding emails (Daily 3 PM UTC)
- `winback_sequence`: Re-engagement for churned users (Daily 6 PM UTC)

**Email provider:** Resend
**Templates:** See `src/emails/` directory

---

### 12. Generate Embeddings (`/api/cron/generate-embeddings`)

**Schedule:** Hourly
**Purpose:** Generates vector embeddings for semantic search.

**Process:**
1. Finds products without embeddings
2. Creates product text representation
3. Calls Gemini text-embedding-004 API
4. Stores 768-dim vectors in pgvector column
5. Batch size: 100 products per run

**Dependencies:**
- `GEMINI_API_KEY` environment variable
- pgvector extension enabled on database

---

## Security

All cron endpoints verify the `CRON_SECRET` environment variable:

```typescript
const cronSecret = process.env.CRON_SECRET
const authHeader = req.headers.get('authorization')

if (authHeader !== `Bearer ${cronSecret}`) {
  return new Response('Unauthorized', { status: 401 })
}
```

Vercel automatically sends the `CRON_SECRET` as a Bearer token for scheduled invocations.

## Manual Execution

Jobs can be triggered manually via curl:

```bash
curl -X POST https://theproductreport.org/api/cron/trending \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or via the Admin Dashboard under **System > Cron Jobs**.

## Monitoring

- **Vercel Dashboard:** Cron job execution logs
- **System Health Dashboard:** Job success/failure rates
- **Sentry:** Error tracking for failed jobs

## Adding New Jobs

1. Create route handler in `src/app/api/cron/[job-name]/route.ts`
2. Add schedule to `vercel.json` crons array
3. Implement CRON_SECRET verification
4. Add monitoring/logging
5. Document in this file
