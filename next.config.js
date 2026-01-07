import { withPayload } from '@payloadcms/next/withPayload'

import redirects from './redirects.js'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined || process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Ignore ESLint during builds (warnings on auto-generated migration files)
    ignoreDuringBuilds: true,
  },
  images: {
    // Use modern image formats for better compression
    formats: ['image/avif', 'image/webp'],
    // Optimized device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Image sizes for srcset generation
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 1 year (immutable content-addressed)
    minimumCacheTTL: 31536000,
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', ''),
        }
      }),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  async headers() {
    // Security headers for all routes
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
      },
      {
        // Content Security Policy - helps prevent XSS attacks
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          // Scripts: self, inline for Next.js hydration, and eval for dev mode
          process.env.NODE_ENV === 'production'
            ? "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com"
            : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          // Styles: self, inline for styled components
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          // Images: self, data URIs, Vercel Blob Storage, common image CDNs
          "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.vercel-storage.com",
          // Fonts: self and Google Fonts
          "font-src 'self' https://fonts.gstatic.com",
          // API connections
          "connect-src 'self' https://*.vercel-insights.com https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com",
          // Media: self and blob storage
          "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
          // Frames: same origin only
          "frame-ancestors 'self'",
          // Form actions
          "form-action 'self'",
          // Base URI
          "base-uri 'self'",
        ].join('; '),
      },
    ]

    // HSTS header (only in production)
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains',
      })
    }

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Apple App Site Association (Universal Links)
        source: '/.well-known/apple-app-site-association',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
      {
        // Android Asset Links (App Links)
        source: '/.well-known/assetlinks.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
