/**
 * OpenAPI/Swagger Configuration
 *
 * Generates OpenAPI 3.1 specification from JSDoc annotations in endpoint files.
 */

import swaggerJSDoc from 'swagger-jsdoc'

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.1.0',
        info: {
            title: 'The Product Report API',
            version: '1.0.0',
            description: `
The Product Report provides a comprehensive API for:
- **Mobile App**: Barcode scanning, product lookup, user profiles
- **Brand Portal**: Analytics, subscription management, competitor insights
- **Admin**: Content management, analytics dashboards, AI tools

## Authentication

Most endpoints require authentication via JWT token:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Mobile endpoints may also use device fingerprint:
\`\`\`
x-fingerprint: <device-fingerprint>
\`\`\`

## Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Standard | 100/min |
| AI Analysis | 10/min |
| Smart Scan | 5/min |
| Mobile Scan | 30/min |

## Environments

- **Production**: https://theproductreport.org/api
- **Brand Portal**: https://brands.theproductreport.org/api
            `,
            contact: {
                name: 'The Product Report',
                url: 'https://theproductreport.org',
            },
        },
        servers: [
            {
                url: 'https://theproductreport.org/api',
                description: 'Production API',
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
            { name: 'Mobile', description: 'Mobile app endpoints' },
            { name: 'Scanner', description: 'Barcode scanning and product lookup' },
            { name: 'Scout Profile', description: 'User contribution profiles' },
            { name: 'Brand Auth', description: 'Brand portal authentication' },
            { name: 'Brand Dashboard', description: 'Brand analytics and data' },
            { name: 'Brand Subscription', description: 'Stripe subscription management' },
            { name: 'User', description: 'User account management' },
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
                    description: 'JWT token from login endpoint',
                },
                fingerprintAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'x-fingerprint',
                    description: 'Device fingerprint for mobile authentication',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                        code: { type: 'string' },
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
                        id: { type: 'number' },
                        name: { type: 'string' },
                        barcode: { type: 'string' },
                        brand: { type: 'string' },
                        category: { type: 'string' },
                        overallScore: { type: 'number', minimum: 0, maximum: 100 },
                        healthScore: { type: 'number', minimum: 0, maximum: 100 },
                        environmentScore: { type: 'number', minimum: 0, maximum: 100 },
                        socialScore: { type: 'number', minimum: 0, maximum: 100 },
                        ingredients: { type: 'array', items: { type: 'string' } },
                    },
                },
                BrandUser: {
                    type: 'object',
                    properties: {
                        id: { type: 'number' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                        role: { type: 'string', enum: ['owner', 'admin', 'analyst'] },
                        subscription: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'] },
                        isVerified: { type: 'boolean' },
                    },
                },
                SubscriptionPlan: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'] },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        monthlyPrice: { type: 'number' },
                        annualPrice: { type: 'number' },
                        features: { type: 'array', items: { type: 'string' } },
                    },
                },
                ScoutProfile: {
                    type: 'object',
                    properties: {
                        slug: { type: 'string' },
                        displayName: { type: 'string' },
                        bio: { type: 'string' },
                        totalScans: { type: 'number' },
                        totalSubmissions: { type: 'number' },
                        badges: { type: 'array', items: { type: 'string' } },
                        rank: { type: 'string' },
                        joinedAt: { type: 'string', format: 'date-time' },
                    },
                },
            },
            responses: {
                Unauthorized: {
                    description: 'Authentication required',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/Error' },
                            example: { error: 'Authentication required' },
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
                RateLimited: {
                    description: 'Rate limit exceeded',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/RateLimitError' },
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
