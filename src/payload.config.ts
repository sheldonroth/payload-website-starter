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
import { Users } from './collections/Users'
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
import { YouTubeSettings } from './globals/YouTubeSettings'

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
    // Skip migrations in production - schema was created via dev mode push
    // Only include migrations when explicitly running `payload migrate`
    ...(process.env.PAYLOAD_MIGRATING ? { prodMigrations: migrations } : {}),
  }),
  collections: [Pages, Posts, Products, Articles, Videos, Media, Categories, InvestigationPolls, SponsoredTestRequests, Users],
  cors: [
    'https://www.theproductreport.org',
    'https://theproductreport.org',
    'https://theproductreport-61qu.vercel.app',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '',
  ].filter(Boolean) as string[],
  globals: [Header, Footer, YouTubeSettings],
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
      path: '/tiktok/analyze',
      method: 'post',
      handler: tiktokAnalyzeHandler,
    },
    {
      path: '/backup/export',
      method: 'get',
      handler: backupExportHandler,
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
