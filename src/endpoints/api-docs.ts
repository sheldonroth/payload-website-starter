/**
 * API Documentation Endpoint
 *
 * Generates OpenAPI/Swagger documentation for all API endpoints.
 * Access at /api/docs for JSON spec or /admin/api-docs for UI.
 */

import type { PayloadHandler } from 'payload'

// API endpoint definitions organized by category
const apiEndpoints = {
  products: [
    {
      path: '/api/scanner/lookup',
      method: 'GET',
      summary: 'Barcode Scanner Lookup',
      description: 'Look up a product by barcode (UPC/EAN). Returns product data or creates a new product request.',
      parameters: [
        { name: 'barcode', in: 'query', required: true, type: 'string', description: 'UPC or EAN barcode' },
        { name: 'userId', in: 'query', required: false, type: 'string', description: 'User ID for tracking' },
      ],
      responses: {
        200: { description: 'Product found', schema: { type: 'object' } },
        404: { description: 'Product not found' },
      },
      tags: ['Products'],
    },
    {
      path: '/api/products',
      method: 'GET',
      summary: 'List Products',
      description: 'Get paginated list of products with optional filters.',
      parameters: [
        { name: 'limit', in: 'query', required: false, type: 'number', description: 'Number of items per page (default: 10)' },
        { name: 'page', in: 'query', required: false, type: 'number', description: 'Page number (default: 1)' },
        { name: 'where[category][equals]', in: 'query', required: false, type: 'string', description: 'Filter by category ID' },
        { name: 'where[verdict][equals]', in: 'query', required: false, type: 'string', description: 'Filter by verdict (green/yellow/red)' },
      ],
      responses: {
        200: { description: 'List of products', schema: { type: 'object' } },
      },
      tags: ['Products'],
    },
    {
      path: '/api/product-preview',
      method: 'GET',
      summary: 'Product Preview',
      description: 'Get minimal product data for quick display (mobile-optimized).',
      parameters: [
        { name: 'id', in: 'query', required: true, type: 'string', description: 'Product ID' },
      ],
      responses: {
        200: { description: 'Product preview data' },
      },
      tags: ['Products'],
    },
    {
      path: '/api/product-alternatives',
      method: 'GET',
      summary: 'Product Alternatives',
      description: 'Find alternative products in the same category with better ratings.',
      parameters: [
        { name: 'productId', in: 'query', required: true, type: 'string', description: 'Source product ID' },
        { name: 'limit', in: 'query', required: false, type: 'number', description: 'Max alternatives to return' },
      ],
      responses: {
        200: { description: 'List of alternative products' },
      },
      tags: ['Products'],
    },
    {
      path: '/api/product-vote',
      method: 'POST',
      summary: 'Vote on Product',
      description: 'Submit a vote (helpful/not helpful) on a product.',
      requestBody: {
        productId: 'string (required)',
        voteType: 'string (helpful|not_helpful)',
        userId: 'string (optional)',
      },
      responses: {
        200: { description: 'Vote recorded' },
      },
      tags: ['Products'],
    },
    {
      path: '/api/featured-products',
      method: 'GET',
      summary: 'Featured Products',
      description: 'Get curated list of featured products.',
      responses: {
        200: { description: 'Featured products list' },
      },
      tags: ['Products'],
    },
  ],
  mobile: [
    {
      path: '/api/mobile/health',
      method: 'GET',
      summary: 'Mobile Health Check',
      description: 'Lightweight health check for mobile apps. Returns server status and feature availability.',
      responses: {
        200: { description: 'Server is healthy' },
        503: { description: 'Server is in maintenance mode' },
      },
      tags: ['Mobile'],
    },
    {
      path: '/api/mobile/config',
      method: 'GET',
      summary: 'Mobile Configuration',
      description: 'Get dynamic configuration and feature flags for mobile apps.',
      parameters: [
        { name: 'platform', in: 'query', required: false, type: 'string', description: 'Platform (ios/android)' },
        { name: 'version', in: 'query', required: false, type: 'string', description: 'App version' },
      ],
      responses: {
        200: { description: 'Configuration object' },
      },
      tags: ['Mobile'],
    },
    {
      path: '/api/mobile/analytics',
      method: 'POST',
      summary: 'Mobile Analytics Events',
      description: 'Submit batch analytics events from mobile app.',
      requestBody: {
        events: 'array of event objects',
        deviceId: 'string (optional)',
      },
      responses: {
        200: { description: 'Events recorded' },
      },
      tags: ['Mobile'],
    },
    {
      path: '/api/mobile/errors',
      method: 'POST',
      summary: 'Mobile Error Reporting',
      description: 'Report crashes and errors from mobile app.',
      requestBody: {
        error: 'string (error message)',
        stack: 'string (stack trace)',
        platform: 'string (ios/android)',
        version: 'string (app version)',
      },
      responses: {
        200: { description: 'Error logged' },
      },
      tags: ['Mobile'],
    },
    {
      path: '/api/app-version',
      method: 'GET',
      summary: 'App Version Check',
      description: 'Check for app updates and get version requirements.',
      parameters: [
        { name: 'platform', in: 'query', required: true, type: 'string', description: 'Platform (ios/android)' },
        { name: 'currentVersion', in: 'query', required: true, type: 'string', description: 'Current app version' },
      ],
      responses: {
        200: { description: 'Version info with update requirements' },
      },
      tags: ['Mobile'],
    },
  ],
  users: [
    {
      path: '/api/users/me',
      method: 'GET',
      summary: 'Current User',
      description: 'Get the currently authenticated user.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'User object' },
        401: { description: 'Not authenticated' },
      },
      tags: ['Users'],
    },
    {
      path: '/api/push-tokens',
      method: 'POST',
      summary: 'Register Push Token',
      description: 'Register or update an Expo push token for notifications.',
      requestBody: {
        token: 'string (Expo push token)',
        platform: 'string (ios/android)',
        deviceId: 'string (optional)',
      },
      responses: {
        200: { description: 'Token registered' },
      },
      tags: ['Users'],
    },
    {
      path: '/api/user-watchlist',
      method: 'GET',
      summary: 'User Watchlist',
      description: 'Get user\'s saved/watched products.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Watchlist items' },
      },
      tags: ['Users'],
    },
    {
      path: '/api/user-watchlist',
      method: 'POST',
      summary: 'Add to Watchlist',
      description: 'Add a product to user\'s watchlist.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        productId: 'string',
      },
      responses: {
        200: { description: 'Added to watchlist' },
      },
      tags: ['Users'],
    },
    {
      path: '/api/feedback',
      method: 'POST',
      summary: 'Submit Feedback',
      description: 'Submit user feedback or bug reports.',
      requestBody: {
        message: 'string',
        email: 'string (optional)',
        platform: 'string (optional)',
      },
      responses: {
        200: { description: 'Feedback submitted' },
      },
      tags: ['Users'],
    },
  ],
  email: [
    {
      path: '/api/email-preferences',
      method: 'GET',
      summary: 'Email Preferences',
      description: 'Get user\'s email notification preferences.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Email preferences' },
      },
      tags: ['Email'],
    },
    {
      path: '/api/email-preferences',
      method: 'POST',
      summary: 'Update Email Preferences',
      description: 'Update user\'s email notification preferences.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        weeklyDigest: 'boolean',
        productUpdates: 'boolean',
        marketingEmails: 'boolean',
      },
      responses: {
        200: { description: 'Preferences updated' },
      },
      tags: ['Email'],
    },
  ],
  analytics: [
    {
      path: '/api/statsig-experiments',
      method: 'GET',
      summary: 'Statsig Experiments',
      description: 'Get all Statsig experiments (admin only).',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'List of experiments' },
      },
      tags: ['Analytics'],
    },
    {
      path: '/api/cache-status',
      method: 'GET',
      summary: 'Cache Status',
      description: 'Get cache statistics and status (admin only).',
      security: [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Cache statistics' },
      },
      tags: ['Analytics'],
    },
  ],
  content: [
    {
      path: '/api/categories',
      method: 'GET',
      summary: 'List Categories',
      description: 'Get paginated list of product categories.',
      parameters: [
        { name: 'limit', in: 'query', required: false, type: 'number', description: 'Items per page' },
        { name: 'depth', in: 'query', required: false, type: 'number', description: 'Relationship depth' },
      ],
      responses: {
        200: { description: 'List of categories' },
      },
      tags: ['Content'],
    },
    {
      path: '/api/brands',
      method: 'GET',
      summary: 'List Brands',
      description: 'Get paginated list of brands.',
      responses: {
        200: { description: 'List of brands' },
      },
      tags: ['Content'],
    },
    {
      path: '/api/posts',
      method: 'GET',
      summary: 'List Posts',
      description: 'Get paginated list of blog posts.',
      parameters: [
        { name: 'where[_status][equals]', in: 'query', required: false, type: 'string', description: 'Filter by status' },
      ],
      responses: {
        200: { description: 'List of posts' },
      },
      tags: ['Content'],
    },
    {
      path: '/api/trending-engine',
      method: 'GET',
      summary: 'Trending Products',
      description: 'Get currently trending products and news.',
      responses: {
        200: { description: 'Trending items' },
      },
      tags: ['Content'],
    },
  ],
  scanning: [
    {
      path: '/api/smart-scan',
      method: 'POST',
      summary: 'Smart Scan (AI)',
      description: 'Analyze product image using AI to extract information.',
      requestBody: {
        image: 'string (base64 or URL)',
      },
      responses: {
        200: { description: 'Extracted product information' },
      },
      tags: ['Scanning'],
    },
    {
      path: '/api/shelf-scan',
      method: 'POST',
      summary: 'Shelf Scan',
      description: 'Scan a store shelf to identify multiple products.',
      requestBody: {
        image: 'string (base64 or URL)',
      },
      responses: {
        200: { description: 'List of identified products' },
      },
      tags: ['Scanning'],
    },
    {
      path: '/api/background-remove',
      method: 'POST',
      summary: 'Remove Image Background',
      description: 'Remove background from product image.',
      requestBody: {
        imageUrl: 'string',
      },
      responses: {
        200: { description: 'Processed image URL' },
      },
      tags: ['Scanning'],
    },
  ],
}

// Generate OpenAPI 3.0 spec
function generateOpenAPISpec() {
  const paths: Record<string, Record<string, unknown>> = {}

  // Process all endpoint categories
  Object.values(apiEndpoints).forEach((category) => {
    category.forEach((endpoint) => {
      const path = endpoint.path
      const method = endpoint.method.toLowerCase()

      if (!paths[path]) {
        paths[path] = {}
      }

      const operation: Record<string, unknown> = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        responses: {},
      }

      // Add parameters
      if ('parameters' in endpoint && endpoint.parameters) {
        operation.parameters = (endpoint.parameters as Array<{ name: string; in: string; required: boolean; type: string; description: string }>).map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          schema: { type: p.type },
          description: p.description,
        }))
      }

      // Add request body
      if ('requestBody' in endpoint && endpoint.requestBody) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.fromEntries(
                  Object.entries(endpoint.requestBody as Record<string, string>).map(([key, desc]) => [
                    key,
                    { type: 'string', description: desc },
                  ])
                ),
              },
            },
          },
        }
      }

      // Add security if specified
      if ('security' in endpoint && endpoint.security) {
        operation.security = endpoint.security
      }

      // Add responses
      Object.entries(endpoint.responses).forEach(([code, resp]) => {
        (operation.responses as Record<string, unknown>)[code] = {
          description: (resp as { description: string }).description,
        }
      })

      paths[path][method] = operation
    })
  })

  return {
    openapi: '3.0.3',
    info: {
      title: 'The Product Report API',
      version: '1.0.0',
      description: `
# The Product Report API

This API powers The Product Report mobile app and website, providing access to product data, user management, and analytics.

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

## Rate Limiting

API requests are rate-limited to protect service availability:
- **Standard endpoints**: 100 requests per minute
- **Search/Scan endpoints**: 30 requests per minute
- **Admin endpoints**: 60 requests per minute

## Response Format

All responses are JSON with this structure:
\`\`\`json
{
  "docs": [...],      // For list endpoints
  "totalDocs": 100,
  "page": 1,
  "totalPages": 10,
  "hasNextPage": true
}
\`\`\`

## Error Handling

Errors return appropriate HTTP status codes with a message:
\`\`\`json
{
  "error": "Error description",
  "message": "Detailed explanation"
}
\`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@theproductreport.org',
      },
    },
    servers: [
      {
        url: 'https://theproductreport.org',
        description: 'Production',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development',
      },
    ],
    tags: [
      { name: 'Products', description: 'Product data and operations' },
      { name: 'Mobile', description: 'Mobile app specific endpoints' },
      { name: 'Users', description: 'User management and preferences' },
      { name: 'Email', description: 'Email notifications and preferences' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'Content', description: 'Categories, brands, and posts' },
      { name: 'Scanning', description: 'Barcode and image scanning' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            verdict: { type: 'string', enum: ['green', 'yellow', 'red'] },
            brand: { type: 'object' },
            category: { type: 'object' },
            barcode: { type: 'string' },
            images: { type: 'array' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            role: { type: 'string' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            parent: { type: 'object' },
          },
        },
        Brand: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            trustScore: { type: 'number' },
          },
        },
      },
    },
    paths,
  }
}

export const apiDocsHandler: PayloadHandler = async (req) => {
  const spec = generateOpenAPISpec()

  // Check if HTML format requested
  const url = new URL(req.url || '', 'http://localhost')
  const format = url.searchParams.get('format')

  if (format === 'html') {
    // Return Swagger UI HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>API Documentation - The Product Report</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin-bottom: 30px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: "list",
        filter: true,
        showExtensions: true,
      });
    };
  </script>
</body>
</html>
`
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  // Return JSON spec
  return Response.json(spec)
}

export default apiDocsHandler
