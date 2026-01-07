// Force rebuild - 2025-12-30
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { vercelPostgresAdapter } from '@payloadcms/db-vercel-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Products } from './collections/Products'
import { Articles } from './collections/Articles'
import { Videos } from './collections/Videos'
import { InvestigationPolls } from './collections/InvestigationPolls'
import { SponsoredTestRequests } from './collections/SponsoredTestRequests'
// import { Ingredients } from './collections/Ingredients' // REMOVED - Liability Shield
import { VerdictRules } from './collections/VerdictRules'
import { AuditLog } from './collections/AuditLog'
import { Users } from './collections/Users'
import { PriceHistory } from './collections/PriceHistory'
import { Brands } from './collections/Brands'
import { RegulatoryChanges } from './collections/RegulatoryChanges'
import { UserSubmissions } from './collections/UserSubmissions'
import { DeviceFingerprints } from './collections/DeviceFingerprints'
import { ProductUnlocks } from './collections/ProductUnlocks'
import { TrendingNews } from './collections/TrendingNews'
import { ProductVotes } from './collections/ProductVotes'
import { BountyCategories } from './collections/BountyCategories'
import { PushTokens } from './collections/PushTokens'
import { Feedback } from './collections/Feedback'
import { Referrals } from './collections/Referrals'
import { ReferralPayouts } from './collections/ReferralPayouts'
import { GeneratedContent } from './collections/GeneratedContent'
import { DailyDiscoveries } from './collections/DailyDiscoveries'
import { EmailTemplates } from './collections/EmailTemplates'
import { EmailSends } from './collections/EmailSends'
import { ScoutProfiles } from './collections/ScoutProfiles'
import { MarketIntelligence } from './collections/MarketIntelligence'
import { BrandAnalytics } from './collections/BrandAnalytics'
import { BrandUsers } from './collections/BrandUsers'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { migrations } from './migrations'
import { oauthEndpoints } from './endpoints/oauth'
import { youtubeSyncHandler } from './endpoints/youtube-sync'
import { videoAnalyzeHandler } from './endpoints/video-analyze'
import { channelAnalyzeHandler } from './endpoints/channel-analyze'
import { pollGenerateHandler } from './endpoints/poll-generate'
import { seoGenerateHandler } from './endpoints/seo-generate'
import { categoryPollHandler } from './endpoints/category-poll-generate'
import { productEnrichHandler, productSearchImagesHandler, productSaveImageHandler } from './endpoints/product-enrich'
import { adminPurgeHandler } from './endpoints/admin-purge'
import { tiktokAnalyzeHandler } from './endpoints/tiktok-analyze'
import { backupExportHandler } from './endpoints/backup-export'
import { magicUrlHandler } from './endpoints/magic-url'
import { categoryEnrichHandler } from './endpoints/category-enrich'
import { emailSend } from './endpoints/email-send'
import { batchEnrichHandler } from './endpoints/batch-enrich'
import { unifiedIngestHandler } from './endpoints/unified-ingest'
import { adminLinkVideosHandler } from './endpoints/admin-link-videos'
import { adminCategoryCleanupHandler } from './endpoints/admin-category-cleanup'
import { backgroundRemoveHandler, backgroundBatchHandler } from './endpoints/background-remove'
import { imageInternalizeHandler, imageInternalizeStatusHandler } from './endpoints/image-internalize'
import { cronJobsHandler } from './endpoints/cron-jobs'
import { bulkOperationsHandler } from './endpoints/bulk-operations'
import { labelDecodeHandler } from './endpoints/label-decode'
import { recallWatchdogHandler } from './endpoints/recall-watchdog'
import { skimpflationDetectorHandler } from './endpoints/skimpflation-detector'
import { regulatoryMonitorHandler } from './endpoints/regulatory-monitor'
import { crowdsourceSubmitHandler, crowdsourceLeaderboardHandler } from './endpoints/crowdsource-submit'
import { contentAmplifyHandler } from './endpoints/content-amplify'
import { brandTrustHandler, brandSyncHandler } from './endpoints/brand-trust'
import { populateBrandsHandler } from './endpoints/populate-brands'
import { productRequestsListHandler, productRequestsCreateHandler, productRequestVoteHandler } from './endpoints/product-requests'
import { userWatchlistGetHandler, userWatchlistAddHandler, userWatchlistRemoveHandler, checkWatchlistConflictsHandler } from './endpoints/user-watchlist'
import { savedProductsGetHandler, savedProductsAddHandler, savedProductsRemoveHandler, savedArticlesGetHandler, savedArticlesAddHandler, savedArticlesRemoveHandler } from './endpoints/user-saved-items'
import { productAlternativesHandler } from './endpoints/product-alternatives'
import { recalculateFeaturedHandler } from './endpoints/featured-products'
import { fingerprintRegisterHandler, fingerprintCheckHandler } from './endpoints/fingerprint'
import { productUnlockHandler, productUnlockStatusHandler } from './endpoints/product-unlock'
import { trendingEngineHandler } from './endpoints/trending-engine'
import { amazonValidateHandler } from './endpoints/amazon-validate'
import { userDataExportHandler, userDeleteAccountHandler } from './endpoints/user-data-export'
import { pollVoteHandler, pollsActiveHandler, pollGetHandler } from './endpoints/poll-vote'
import { adminBackfillTitlesHandler } from './endpoints/admin-backfill-titles'
import { imageExtractHandler, imageExtractApplyHandler } from './endpoints/image-extract'
import { errorRetryHandler } from './endpoints/error-retry'
import { productPreviewHandler, productConfirmHandler } from './endpoints/product-preview'
import { appVersionHandler } from './endpoints/app-version'
import { userSubscriptionHandler } from './endpoints/user-subscription'
import { productVoteHandler, productVoteStatusHandler, productVoteLeaderboardHandler, productVoteContributeHandler, productVoteQueueHandler, myInvestigationsHandler } from './endpoints/product-vote'
import { productReportHandler } from './endpoints/product-report'
import { pushTokenRegisterHandler, pushTokenSubscribeHandler, pushTokenUnsubscribeHandler } from './endpoints/push-tokens'
import { scannerLookupHandler, scannerSubmitHandler } from './endpoints/scanner'
import { voteSubmissionHandler } from './endpoints/vote-submission'
import { feedbackHandler } from './endpoints/feedback'
import { behaviorUpdateHandler } from './endpoints/behavior-update'
import { revenuecatWebhookHandler } from './endpoints/revenuecat-webhook'
import { referralEndpoints } from './endpoints/referral'
import { businessAnalyticsEndpoint } from './endpoints/business-analytics'
import { businessAnalyticsExportEndpoint } from './endpoints/business-analytics/export'
import { getScoutProfileHandler, getMyScoutStatsHandler, updateScoutProfileHandler, registerScoutContributionHandler } from './endpoints/scout-profile'
import contentGeneratorHandler from './endpoints/content-generator'
import { emailCronHandler } from './endpoints/email-cron'
import { resendWebhookHandler } from './endpoints/email-webhook'
import { emailEventTriggerHandler } from './endpoints/email-event-trigger'
import { smartScanHandler } from './endpoints/smart-scan'
import { recalculateCategoryCountsEndpoint } from './endpoints/recalculate-category-counts'
import { aiAssistantEndpoint, aiAssistantClearCacheEndpoint } from './endpoints/ai-assistant'
import { sendResultsNotificationHandler, sendTestingNotificationHandler } from './endpoints/send-results-notification'
import { activeBountiesHandler, checkBountyHandler } from './endpoints/bounty-categories'
import { emailPreferencesEndpoint, emailPreferencesUpdateEndpoint, emailPreferencesUnsubscribeEndpoint } from './endpoints/email-preferences'
import { emailTemplatePreviewEndpoint } from './endpoints/email-template-preview'
import { emailTemplateTestEndpoint } from './endpoints/email-template-test'
import { emailAnalyticsEndpoint } from './endpoints/email-analytics'
import { statsigExperimentsHandler } from './endpoints/statsig-experiments'
import { userAnalyticsHandler } from './endpoints/user-analytics'
import { productEngagementAnalyticsHandler } from './endpoints/product-engagement-analytics'
import { contentModerationHandler } from './endpoints/content-moderation'
import { brandAuthEndpoints } from './endpoints/brand-auth'
import { brandDashboardEndpoints } from './endpoints/brand-dashboard'
import { brandSubscriptionEndpoints } from './endpoints/brand-subscription'
import { YouTubeSettings } from './globals/YouTubeSettings'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeDashboard: ['@/components/BeforeDashboard'],
      // Custom admin views
      views: {
        'ai-tools': {
          Component: '@/components/AITools',
          path: '/ai-tools',
        },
        'ai-suggestions': {
          Component: '@/components/AIProductSuggestions',
          path: '/ai-suggestions',
        },
        'suggested-categories': {
          Component: '@/components/SuggestedCategories',
          path: '/suggested-categories',
        },
        'analytics': {
          Component: '@/components/AnalyticsDashboard',
          path: '/analytics',
        },
        'business-analytics': {
          Component: '@/components/BusinessAnalyticsDashboard',
          path: '/business-analytics',
        },
        'ai-assistant': {
          Component: '@/components/AIBusinessAssistant',
          path: '/ai-assistant',
        },
        'content-engine': {
          Component: '@/components/ContentEngine',
          path: '/content-engine',
        },
        'email-ab': {
          Component: '@/components/EmailABDashboard',
          path: '/email-ab',
        },
        'email-analytics': {
          Component: '@/components/EmailAnalyticsDashboard',
          path: '/email-analytics',
        },
        'statsig-experiments': {
          Component: '@/components/StatsigDashboard',
          path: '/statsig-experiments',
        },
        'user-analytics': {
          Component: '@/components/UserAnalyticsDashboard',
          path: '/user-analytics',
        },
        'product-engagement': {
          Component: '@/components/ProductEngagementDashboard',
          path: '/product-engagement',
        },
        'content-moderation': {
          Component: '@/components/ContentModerationDashboard',
          path: '/content-moderation',
        },
        'system-health': {
          Component: '@/components/SystemHealthDashboard',
          path: '/system-health',
        },
      },
      // Sidebar nav links
      afterNavLinks: ['@/components/AdminNavLinks'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: vercelPostgresAdapter({
    pool: {
      connectionString: process.env.POSTGRES_URL || '',
      max: 5,                      // Limit concurrent connections
      idleTimeoutMillis: 10000,    // Release idle connections after 10s
      connectionTimeoutMillis: 3000, // Fail fast if can't connect
    },
    push: false,                   // Disable dev auto-push to prevent migration prompts
    // Always include migrations for production builds
    prodMigrations: migrations,
  }),
  collections: [Pages, Posts, Products, Articles, Videos, Media, Categories, InvestigationPolls, SponsoredTestRequests, VerdictRules, AuditLog, Users, PriceHistory, Brands, RegulatoryChanges, UserSubmissions, DeviceFingerprints, ProductUnlocks, TrendingNews, ProductVotes, BountyCategories, PushTokens, Feedback, Referrals, ReferralPayouts, GeneratedContent, DailyDiscoveries, EmailTemplates, EmailSends, ScoutProfiles, MarketIntelligence, BrandAnalytics, BrandUsers],
  cors: [
    // Main website
    'https://www.theproductreport.org',
    'https://theproductreport.org',
    'https://theproductreport-61qu.vercel.app',
    // Brand Portal
    'https://brands.theproductreport.org',
    'https://brand-portal.theproductreport.org',
    // Development
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3002' : '', // Brand portal dev
  ].filter(Boolean) as string[],
  globals: [Header, Footer, YouTubeSettings, SiteSettings],
  endpoints: [
    ...oauthEndpoints,
    {
      path: '/youtube/sync',
      method: 'post',
      handler: youtubeSyncHandler,
    },
    {
      path: '/video/analyze',
      method: 'post',
      handler: videoAnalyzeHandler,
    },
    {
      path: '/channel/analyze',
      method: 'post',
      handler: channelAnalyzeHandler,
    },
    {
      path: '/poll/generate',
      method: 'post',
      handler: pollGenerateHandler,
    },
    {
      path: '/seo/generate',
      method: 'post',
      handler: seoGenerateHandler,
    },
    {
      path: '/poll/category',
      method: 'post',
      handler: categoryPollHandler,
    },
    {
      path: '/product/enrich',
      method: 'post',
      handler: productEnrichHandler,
    },
    {
      path: '/product/search-images',
      method: 'post',
      handler: productSearchImagesHandler,
    },
    {
      path: '/product/save-image',
      method: 'post',
      handler: productSaveImageHandler,
    },
    {
      path: '/background/remove',
      method: 'post',
      handler: backgroundRemoveHandler,
    },
    {
      path: '/background/batch',
      method: 'post',
      handler: backgroundBatchHandler,
    },
    {
      path: '/images/internalize/status',
      method: 'get',
      handler: imageInternalizeStatusHandler,
    },
    {
      path: '/images/internalize',
      method: 'post',
      handler: imageInternalizeHandler,
    },
    {
      path: '/admin/purge',
      method: 'post',
      handler: adminPurgeHandler,
    },
    {
      path: '/admin/link-videos',
      method: 'post',
      handler: adminLinkVideosHandler,
    },
    {
      path: '/admin/category-cleanup',
      method: 'post',
      handler: adminCategoryCleanupHandler,
    },
    {
      path: '/admin/populate-brands',
      method: 'post',
      handler: populateBrandsHandler,
    },
    {
      path: '/admin/recalculate-featured',
      method: 'post',
      handler: recalculateFeaturedHandler,
    },
    recalculateCategoryCountsEndpoint,
    aiAssistantEndpoint,
    aiAssistantClearCacheEndpoint,
    // Product Request Queue
    {
      path: '/product-requests',
      method: 'get',
      handler: productRequestsListHandler,
    },
    {
      path: '/product-requests',
      method: 'post',
      handler: productRequestsCreateHandler,
    },
    {
      path: '/product-requests/vote',
      method: 'post',
      handler: productRequestVoteHandler,
    },
    {
      path: '/cron/jobs',
      method: 'post',
      handler: cronJobsHandler,
    },
    {
      path: '/bulk/operations',
      method: 'post',
      handler: bulkOperationsHandler,
    },
    {
      path: '/tiktok/analyze',
      method: 'post',
      handler: tiktokAnalyzeHandler,
    },
    {
      path: '/backup/export',
      method: 'get',
      handler: backupExportHandler,
    },
    {
      path: '/magic-url',
      method: 'post',
      handler: magicUrlHandler,
    },
    {
      path: '/category/enrich',
      method: 'post',
      handler: categoryEnrichHandler,
    },
    {
      path: '/email/send',
      method: 'post',
      handler: emailSend,
    },
    {
      path: '/batch/enrich',
      method: 'post',
      handler: batchEnrichHandler,
    },
    {
      path: '/ingest',
      method: 'post',
      handler: unifiedIngestHandler,
    },
    {
      path: '/label/decode',
      method: 'post',
      handler: labelDecodeHandler,
    },
    {
      path: '/recall/check',
      method: 'post',
      handler: recallWatchdogHandler,
    },
    {
      path: '/skimpflation/check',
      method: 'post',
      handler: skimpflationDetectorHandler,
    },
    {
      path: '/regulatory/monitor',
      method: 'post',
      handler: regulatoryMonitorHandler,
    },
    {
      path: '/crowdsource/submit',
      method: 'post',
      handler: crowdsourceSubmitHandler,
    },
    {
      path: '/crowdsource/leaderboard',
      method: 'get',
      handler: crowdsourceLeaderboardHandler,
    },
    {
      path: '/content/amplify',
      method: 'post',
      handler: contentAmplifyHandler,
    },
    {
      path: '/brand/trust',
      method: 'post',
      handler: brandTrustHandler,
    },
    {
      path: '/brand/sync',
      method: 'post',
      handler: brandSyncHandler,
    },
    // User Watchlist Endpoints
    {
      path: '/users/me/watchlist',
      method: 'get',
      handler: userWatchlistGetHandler,
    },
    {
      path: '/users/me/watchlist',
      method: 'post',
      handler: userWatchlistAddHandler,
    },
    {
      path: '/users/me/watchlist',
      method: 'delete',
      handler: userWatchlistRemoveHandler,
    },
    {
      path: '/users/me/watchlist/check',
      method: 'post',
      handler: checkWatchlistConflictsHandler,
    },
    // User Saved Products Endpoints
    {
      path: '/users/me/saved-products',
      method: 'get',
      handler: savedProductsGetHandler,
    },
    {
      path: '/users/me/saved-products',
      method: 'post',
      handler: savedProductsAddHandler,
    },
    {
      path: '/users/me/saved-products',
      method: 'delete',
      handler: savedProductsRemoveHandler,
    },
    // User Saved Articles Endpoints
    {
      path: '/users/me/saved-articles',
      method: 'get',
      handler: savedArticlesGetHandler,
    },
    {
      path: '/users/me/saved-articles',
      method: 'post',
      handler: savedArticlesAddHandler,
    },
    {
      path: '/users/me/saved-articles',
      method: 'delete',
      handler: savedArticlesRemoveHandler,
    },
    // Product Alternatives (Find Safe Alternative)
    {
      path: '/products/alternatives',
      method: 'get',
      handler: productAlternativesHandler,
    },
    // Fingerprint Registration (One-Shot Engine)
    {
      path: '/fingerprint/register',
      method: 'post',
      handler: fingerprintRegisterHandler,
    },
    {
      path: '/fingerprint/check',
      method: 'get',
      handler: fingerprintCheckHandler,
    },
    // Product Unlock (One-Shot Engine)
    {
      path: '/products/unlock',
      method: 'post',
      handler: productUnlockHandler,
    },
    {
      path: '/products/unlock/status',
      method: 'get',
      handler: productUnlockStatusHandler,
    },
    // Image OCR Extraction
    {
      path: '/products/extract-from-image',
      method: 'post',
      handler: imageExtractHandler,
    },
    {
      path: '/products/extract-from-image/apply',
      method: 'post',
      handler: imageExtractApplyHandler,
    },
    {
      path: '/trending/update',
      method: 'post',
      handler: trendingEngineHandler,
    },
    {
      path: '/amazon/validate',
      method: 'post',
      handler: amazonValidateHandler,
    },
    // GDPR/CCPA User Data Rights
    {
      path: '/user/export-data',
      method: 'get',
      handler: userDataExportHandler,
    },
    {
      path: '/user/delete-account',
      method: 'post',
      handler: userDeleteAccountHandler,
    },
    // Poll Voting
    {
      path: '/polls/vote',
      method: 'post',
      handler: pollVoteHandler,
    },
    {
      path: '/polls/active',
      method: 'get',
      handler: pollsActiveHandler,
    },
    {
      path: '/polls/get',
      method: 'get',
      handler: pollGetHandler,
    },
    // Admin utilities
    {
      path: '/admin/backfill-titles',
      method: 'post',
      handler: adminBackfillTitlesHandler,
    },
    // Error retry endpoint
    {
      path: '/error/retry',
      method: 'post',
      handler: errorRetryHandler,
    },
    // Product preview endpoints (One-Click Ingestion)
    {
      path: '/product/preview',
      method: 'post',
      handler: productPreviewHandler,
    },
    {
      path: '/product/confirm',
      method: 'post',
      handler: productConfirmHandler,
    },
    // App Version Check (Force Update)
    {
      path: '/app-version',
      method: 'get',
      handler: appVersionHandler,
    },
    // User Subscription Status (for frontend auth)
    {
      path: '/user-subscription',
      method: 'get',
      handler: userSubscriptionHandler,
    },
    // Product Voting (Proof of Possession)
    {
      path: '/product-vote',
      method: 'post',
      handler: productVoteHandler,
    },
    {
      path: '/product-vote/status',
      method: 'get',
      handler: productVoteStatusHandler,
    },
    {
      path: '/product-vote/leaderboard',
      method: 'get',
      handler: productVoteLeaderboardHandler,
    },
    // Product Vote Queue (Two-Tier Voting System)
    {
      path: '/product-vote/contribute',
      method: 'post',
      handler: productVoteContributeHandler,
    },
    {
      path: '/product-vote/queue',
      method: 'get',
      handler: productVoteQueueHandler,
    },
    // My Investigations (Scout Program)
    {
      path: '/product-vote/my-investigations',
      method: 'get',
      handler: myInvestigationsHandler,
    },
    // Product Report (barcode lookup)
    {
      path: '/product-report/:barcode',
      method: 'get',
      handler: productReportHandler,
    },
    // Push Token Registration & Subscriptions
    {
      path: '/push-tokens/register',
      method: 'post',
      handler: pushTokenRegisterHandler,
    },
    {
      path: '/push-tokens/subscribe',
      method: 'post',
      handler: pushTokenSubscribeHandler,
    },
    {
      path: '/push-tokens/unsubscribe',
      method: 'post',
      handler: pushTokenUnsubscribeHandler,
    },
    // Scout Program Notifications (Admin-triggered)
    {
      path: '/send-results-notification',
      method: 'post',
      handler: sendResultsNotificationHandler,
    },
    {
      path: '/send-testing-notification',
      method: 'post',
      handler: sendTestingNotificationHandler,
    },
    // Bounty Categories (Scout Program)
    {
      path: '/bounty-categories/active',
      method: 'get',
      handler: activeBountiesHandler,
    },
    {
      path: '/bounty-categories/check',
      method: 'post',
      handler: checkBountyHandler,
    },
    // Scanner (Mobile App Barcode Scanning)
    {
      path: '/scanner/lookup',
      method: 'post',
      handler: scannerLookupHandler,
    },
    {
      path: '/scanner/submit',
      method: 'post',
      handler: scannerSubmitHandler,
    },
    // Vote Submission (for UserSubmissions voting)
    {
      path: '/vote-submission',
      method: 'post',
      handler: voteSubmissionHandler,
    },
    {
      path: '/submit-feedback',
      method: 'post',
      handler: feedbackHandler,
    },
    // Cortex Analytics - Behavior Metrics Update
    {
      path: '/device-fingerprints/behavior',
      method: 'post',
      handler: behaviorUpdateHandler,
    },
    // RevenueCat Webhook - Subscription lifecycle for referral commissions
    revenuecatWebhookHandler,
    // Referral System Endpoints
    ...referralEndpoints,
    // Business Analytics Dashboard
    businessAnalyticsEndpoint,
    businessAnalyticsExportEndpoint,
    // Scout Profile Endpoints (Scout Program)
    {
      path: '/scout-profile/:slug',
      method: 'get',
      handler: getScoutProfileHandler,
    },
    {
      path: '/my-scout-stats',
      method: 'get',
      handler: getMyScoutStatsHandler,
    },
    {
      path: '/scout-profile/update',
      method: 'post',
      handler: updateScoutProfileHandler,
    },
    {
      path: '/scout-profile/register-contribution',
      method: 'post',
      handler: registerScoutContributionHandler,
    },
    // Content Generator
    {
      path: '/content/generate',
      method: 'post',
      handler: contentGeneratorHandler,
    },
    // Email System
    emailCronHandler,
    resendWebhookHandler,
    emailEventTriggerHandler,
    // Smart Scan AI Vision
    smartScanHandler,
    // Email Preferences (One-Click Unsubscribe)
    emailPreferencesEndpoint,
    emailPreferencesUpdateEndpoint,
    emailPreferencesUnsubscribeEndpoint,
    // Email Template Preview & Testing
    emailTemplatePreviewEndpoint,
    emailTemplateTestEndpoint,
    emailAnalyticsEndpoint,
    // Statsig Experiments Dashboard
    {
      path: '/statsig-experiments',
      method: 'get',
      handler: statsigExperimentsHandler,
    },
    // User Analytics Dashboard
    {
      path: '/user-analytics',
      method: 'get',
      handler: userAnalyticsHandler,
    },
    // Product Engagement Analytics
    {
      path: '/product-engagement-analytics',
      method: 'get',
      handler: productEngagementAnalyticsHandler,
    },
    // Content Moderation Queue
    {
      path: '/content-moderation',
      method: 'get',
      handler: contentModerationHandler,
    },
    // Brand Portal Auth
    ...brandAuthEndpoints,
    // Brand Portal Dashboard
    ...brandDashboardEndpoints,
    // Brand Portal Subscription
    ...brandSubscriptionEndpoints,
  ],
  plugins: [
    ...plugins,
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN || '',
    }),
  ],
  email: resendAdapter({
    defaultFromAddress: 'noreply@theproductreport.org',
    defaultFromName: 'The Product Report',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  secret: process.env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [],
  },
})
