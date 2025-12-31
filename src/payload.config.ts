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
import { Ingredients } from './collections/Ingredients'
import { VerdictRules } from './collections/VerdictRules'
import { AuditLog } from './collections/AuditLog'
import { Users } from './collections/Users'
import { PriceHistory } from './collections/PriceHistory'
import { Brands } from './collections/Brands'
import { RegulatoryChanges } from './collections/RegulatoryChanges'
import { UserSubmissions } from './collections/UserSubmissions'
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
import { productEnrichHandler } from './endpoints/product-enrich'
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
  collections: [Pages, Posts, Products, Articles, Videos, Media, Categories, InvestigationPolls, SponsoredTestRequests, Ingredients, VerdictRules, AuditLog, Users, PriceHistory, Brands, RegulatoryChanges, UserSubmissions],
  cors: [
    'https://www.theproductreport.org',
    'https://theproductreport.org',
    'https://theproductreport-61qu.vercel.app',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '',
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
