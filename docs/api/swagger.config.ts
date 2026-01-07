/**
 * OpenAPI/Swagger Configuration
 *
 * Generates OpenAPI 3.1 specification from JSDoc annotations in endpoint files.
 *
 * @module docs/api/swagger.config
 */

import swaggerJSDoc from 'swagger-jsdoc'

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.1.0',
        info: {
            title: 'The Product Report API',
            version: '1.0.0',
            description: `
# The Product Report API

This API powers The Product Report mobile app and website, providing product health analysis, barcode scanning, voting, and user management.

## Overview

The Product Report provides a comprehensive API for:
- **Mobile App**: Barcode scanning, product lookup, user profiles, voting
- **Brand Portal**: Analytics, subscription management, competitor insights
- **Admin**: Content management, analytics dashboards, AI tools

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | \`https://payload-website-starter-smoky-sigma.vercel.app/api\` |
| Brand Portal | \`https://brands.theproductreport.org/api\` |
| Development | \`http://localhost:3000/api\` |

## Authentication

The API uses multiple authentication methods depending on the endpoint:

### JWT Bearer Token
Most authenticated endpoints require a JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Fingerprint Authentication
Mobile endpoints use device fingerprinting for anonymous tracking:
\`\`\`
x-fingerprint: <device-fingerprint-hash>
\`\`\`

### API Key Authentication (Internal)
Server-to-server calls use API key authentication:
\`\`\`
x-api-key: <api-key>
\`\`\`

## Rate Limits

| Endpoint Type | Limit | Notes |
|--------------|-------|-------|
| Standard | 100/min | Most read endpoints |
| Scanner/Lookup | 30/min | Barcode scanning |
| Auth | 5/min | Login, signup |
| AI Analysis | 10/min | Smart scan, OCR |
| Webhooks | 60/min | External service webhooks |

Rate limit headers are included in responses:
\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
\`\`\`

## Response Format

### Success Response (Lists)
\`\`\`json
{
  "docs": [...],
  "totalDocs": 100,
  "page": 1,
  "totalPages": 10,
  "hasNextPage": true
}
\`\`\`

### Success Response (Single)
\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

### Error Response
\`\`\`json
{
  "error": "Error type",
  "message": "Human-readable description",
  "code": "ERROR_CODE"
}
\`\`\`

## Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing/invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

## Webhooks

The API receives webhooks from:
- **Resend** - Email delivery events (delivered, opened, clicked, bounced)
- **RevenueCat** - Subscription lifecycle events (purchase, renewal, cancellation)

All webhooks require signature verification for security.
            `,
            contact: {
                name: 'The Product Report Support',
                email: 'support@theproductreport.org',
                url: 'https://theproductreport.org/support',
            },
            license: {
                name: 'Proprietary',
                url: 'https://theproductreport.org/terms',
            },
        },
        servers: [
            {
                url: 'https://payload-website-starter-smoky-sigma.vercel.app/api',
                description: 'Production API',
            },
            {
                url: 'https://theproductreport.org/api',
                description: 'Production Frontend API',
            },
            {
                url: 'https://brands.theproductreport.org/api',
                description: 'Brand Portal API',
            },
            {
                url: 'http://localhost:3000/api',
                description: 'Local Development',
            },
        ],
        tags: [
            { name: 'Scanner', description: 'Barcode scanning and product lookup' },
            { name: 'Product Report', description: 'Product health analysis and reports' },
            { name: 'Voting', description: 'Product testing vote system (Proof of Possession)' },
            { name: 'Brand Auth', description: 'Brand Portal authentication' },
            { name: 'User', description: 'User account and subscription management' },
            { name: 'Fingerprint', description: 'Device fingerprinting for anonymous tracking' },
            { name: 'Webhooks', description: 'Inbound webhooks from third-party services' },
            { name: 'Mobile', description: 'Mobile app specific endpoints' },
            { name: 'Scout', description: 'Product Scout investigation tracking' },
            { name: 'Brand Dashboard', description: 'Brand analytics and data' },
            { name: 'Email', description: 'Email automation and preferences' },
            { name: 'Admin', description: 'Administrative endpoints' },
            { name: 'AI', description: 'AI-powered analysis endpoints' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from login endpoint',
                },
                fingerprintAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-fingerprint',
                    description: 'Device fingerprint hash for anonymous tracking',
                },
                apiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-api-key',
                    description: 'Server-to-server API key',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', description: 'Error type' },
                        message: { type: 'string', description: 'Error description' },
                        code: { type: 'string', description: 'Error code for programmatic handling' },
                    },
                },
                RateLimitError: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Rate limit exceeded' },
                        retryAfter: { type: 'number', example: 60 },
                        message: { type: 'string' },
                    },
                },
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer', description: 'Product ID' },
                        name: { type: 'string', description: 'Product name' },
                        slug: { type: 'string', description: 'URL-friendly slug' },
                        barcode: { type: 'string', description: 'UPC/EAN barcode' },
                        brand: { type: 'string', description: 'Brand name' },
                        imageUrl: { type: 'string', format: 'uri', description: 'Product image URL' },
                        overallScore: { type: 'integer', minimum: 0, maximum: 100, description: 'Health score 0-100' },
                        overallGrade: {
                            type: 'string',
                            enum: ['A', 'B', 'C', 'D', 'F'],
                            description: 'Letter grade',
                        },
                        source: {
                            type: 'string',
                            enum: ['local', 'openfoodfacts', 'barcodelookup'],
                            description: 'Data source',
                        },
                        confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence score' },
                    },
                },
                ProductReport: {
                    type: 'object',
                    description: 'Comprehensive product health report',
                    properties: {
                        source: {
                            type: 'string',
                            enum: ['complete', 'external', 'internal'],
                            description: 'Report data source type',
                        },
                        barcode: { type: 'string' },
                        productName: { type: 'string' },
                        brand: { type: 'string' },
                        imageUrl: { type: 'string', format: 'uri' },
                        overallScore: { type: 'integer', minimum: 0, maximum: 100 },
                        overallGrade: { type: 'string', enum: ['A', 'B', 'C', 'D', 'F'] },
                        healthSummary: { type: 'string' },
                        quickVerdict: { type: 'string' },
                        categoryScores: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    category: { type: 'string' },
                                    score: { type: 'integer' },
                                    grade: { type: 'string' },
                                    label: { type: 'string' },
                                    summary: { type: 'string' },
                                },
                            },
                        },
                        lastUpdated: { type: 'string', format: 'date-time' },
                        dataSource: { type: 'string' },
                        confidence: { type: 'number' },
                    },
                },
                VoteResponse: {
                    type: 'object',
                    description: 'Response from vote registration',
                    properties: {
                        success: { type: 'boolean' },
                        voteRegistered: { type: 'boolean' },
                        totalVotes: { type: 'integer', description: 'Total unique voters' },
                        yourVoteRank: { type: 'integer', description: 'Your position in queue' },
                        fundingProgress: { type: 'integer', description: 'Percentage to threshold' },
                        fundingThreshold: { type: 'integer' },
                        productInfo: {
                            type: 'object',
                            properties: {
                                barcode: { type: 'string' },
                                name: { type: 'string' },
                                brand: { type: 'string' },
                                imageUrl: { type: 'string' },
                            },
                        },
                        message: { type: 'string' },
                    },
                },
                BrandUser: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                        role: { type: 'string', enum: ['admin', 'manager', 'analyst'] },
                        subscription: { type: 'string', enum: ['free', 'starter', 'growth', 'enterprise'] },
                        isVerified: { type: 'boolean' },
                        brand: {
                            type: 'object',
                            properties: {
                                id: { type: 'integer' },
                                name: { type: 'string' },
                                slug: { type: 'string' },
                                trustScore: { type: 'number' },
                                trustGrade: { type: 'string' },
                            },
                        },
                    },
                },
                DeviceFingerprint: {
                    type: 'object',
                    properties: {
                        fingerprintId: { type: 'integer' },
                        canUnlock: { type: 'boolean', description: 'Whether device can unlock content' },
                        remainingCredits: { type: 'integer', description: 'Remaining free unlocks' },
                        isExisting: { type: 'boolean' },
                        userId: { type: 'integer', nullable: true },
                        gpcRespected: { type: 'boolean', description: 'GPC signal was honored' },
                    },
                },
                UserSubscription: {
                    type: 'object',
                    properties: {
                        found: { type: 'boolean' },
                        email: { type: 'string', format: 'email' },
                        userId: { type: 'integer' },
                        name: { type: 'string' },
                        subscriptionStatus: {
                            type: 'string',
                            enum: ['free', 'premium', 'lifetime'],
                        },
                        memberState: {
                            type: 'string',
                            enum: ['virgin', 'trialist', 'member', 'churned'],
                        },
                        trialEndDate: { type: 'string', format: 'date-time' },
                        isPremium: { type: 'boolean' },
                        hasStripe: { type: 'boolean' },
                        hasRevenueCat: { type: 'boolean' },
                    },
                },
                Investigation: {
                    type: 'object',
                    description: 'User investigation (My Cases) for product tracking',
                    properties: {
                        barcode: { type: 'string' },
                        productName: { type: 'string' },
                        brand: { type: 'string' },
                        imageUrl: { type: 'string' },
                        status: {
                            type: 'string',
                            enum: ['waiting', 'testing', 'complete'],
                        },
                        queuePosition: { type: 'integer', nullable: true },
                        fundingProgress: { type: 'integer' },
                        yourScoutNumber: { type: 'integer' },
                        totalScouts: { type: 'integer' },
                        isFirstScout: { type: 'boolean' },
                        didContributePhotos: { type: 'boolean' },
                        isTrending: { type: 'boolean' },
                        velocityChange24h: { type: 'integer' },
                        linkedProductId: { type: 'string', nullable: true },
                    },
                },
                ScoutProfile: {
                    type: 'object',
                    properties: {
                        slug: { type: 'string' },
                        displayName: { type: 'string' },
                        bio: { type: 'string' },
                        totalScans: { type: 'integer' },
                        totalSubmissions: { type: 'integer' },
                        badges: { type: 'array', items: { type: 'string' } },
                        rank: { type: 'string' },
                        joinedAt: { type: 'string', format: 'date-time' },
                    },
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', format: 'password' },
                    },
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        token: { type: 'string' },
                        exp: { type: 'integer', description: 'Token expiration timestamp' },
                        user: { $ref: '#/components/schemas/BrandUser' },
                    },
                },
                SignupRequest: {
                    type: 'object',
                    required: ['email', 'password', 'name'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', format: 'password', minLength: 8 },
                        name: { type: 'string' },
                        brandName: { type: 'string' },
                        companyWebsite: { type: 'string', format: 'uri' },
                        jobTitle: { type: 'string' },
                        phone: { type: 'string' },
                    },
                },
            },
            responses: {
                ValidationError: {
                    description: 'Validation error - invalid or missing parameters',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    error: { type: 'string', example: 'Validation Error' },
                                    message: { type: 'string', example: 'barcode is required' },
                                },
                            },
                        },
                    },
                },
                Unauthorized: {
                    description: 'Authentication required or invalid credentials',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { error: 'Unauthorized', message: 'Invalid or expired token' },
                        },
                    },
                },
                Forbidden: {
                    description: 'Insufficient permissions',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { error: 'Forbidden', code: 'INSUFFICIENT_TIER' },
                        },
                    },
                },
                NotFound: {
                    description: 'Resource not found',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { error: 'Not Found', message: 'Product not found' },
                        },
                    },
                },
                RateLimited: {
                    description: 'Too many requests - rate limited',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RateLimitError' },
                        },
                    },
                    headers: {
                        'Retry-After': {
                            description: 'Seconds until rate limit resets',
                            schema: { type: 'integer' },
                        },
                    },
                },
                InternalError: {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { error: 'Internal Server Error', message: 'An unexpected error occurred' },
                        },
                    },
                },
            },
        },
    },
    apis: [
        './src/endpoints/**/*.ts',
        './src/app/api/**/*.ts',
    ],
}

export const swaggerSpec = swaggerJSDoc(options)

export default options
