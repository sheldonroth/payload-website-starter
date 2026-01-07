/**
 * API Documentation Endpoint
 *
 * Serves interactive Swagger UI for API exploration.
 * GET /api/docs - HTML documentation page
 * GET /api/docs?format=json - OpenAPI JSON specification
 *
 * @module app/api/docs/route
 */

import { NextResponse } from 'next/server'
import { swaggerSpec } from '../../../../docs/api/swagger.config'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

    // Return JSON spec
    if (format === 'json') {
        return NextResponse.json(swaggerSpec, {
            headers: {
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        })
    }

    // Return Swagger UI HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Product Report API Documentation</title>
    <link rel="icon" type="image/png" href="https://theproductreport.org/favicon.png">
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css">
    <style>
        :root {
            --primary-color: #059669;
            --primary-dark: #047857;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, sans-serif;
        }

        /* Hide default topbar */
        .swagger-ui .topbar {
            display: none;
        }

        /* Custom header */
        .custom-header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            padding: 24px 32px;
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .custom-header h1 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 600;
        }

        .custom-header .subtitle {
            opacity: 0.9;
            font-size: 0.9rem;
            margin-top: 4px;
        }

        .custom-header .links {
            margin-left: auto;
            display: flex;
            gap: 16px;
        }

        .custom-header a {
            color: white;
            text-decoration: none;
            font-size: 0.875rem;
            opacity: 0.9;
            transition: opacity 0.2s;
        }

        .custom-header a:hover {
            opacity: 1;
        }

        /* Improve info section */
        .swagger-ui .info {
            margin: 24px 0;
        }

        .swagger-ui .info .title {
            font-size: 2rem;
            color: #1f2937;
        }

        .swagger-ui .info .description {
            font-size: 0.95rem;
            line-height: 1.6;
        }

        .swagger-ui .info .description h1 {
            display: none; /* Hide duplicate title */
        }

        /* Server selector styling */
        .swagger-ui .scheme-container {
            background: #f9fafb;
            padding: 16px 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,.08);
        }

        /* Operation styling */
        .swagger-ui .opblock-tag {
            font-size: 1.1rem;
            border-bottom: 1px solid #e5e7eb;
        }

        .swagger-ui .opblock.opblock-post {
            border-color: #059669;
            background: rgba(5, 150, 105, 0.05);
        }

        .swagger-ui .opblock.opblock-post .opblock-summary-method {
            background: #059669;
        }

        .swagger-ui .opblock.opblock-get {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.05);
        }

        .swagger-ui .opblock.opblock-get .opblock-summary-method {
            background: #3b82f6;
        }

        .swagger-ui .opblock.opblock-delete {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.05);
        }

        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
            background: #ef4444;
        }

        /* Try it out button */
        .swagger-ui .btn.try-out__btn {
            border-color: #059669;
            color: #059669;
        }

        .swagger-ui .btn.try-out__btn:hover {
            background: #059669;
            color: white;
        }

        .swagger-ui .btn.execute {
            background: #059669;
            border-color: #059669;
        }

        .swagger-ui .btn.execute:hover {
            background: #047857;
        }

        /* Auth status */
        .auth-status {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,.15);
            font-size: 0.875rem;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .auth-status.authenticated {
            border-left: 3px solid #059669;
        }

        .auth-status.unauthenticated {
            border-left: 3px solid #f59e0b;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
            .custom-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }

            .custom-header .links {
                margin-left: 0;
            }
        }
    </style>
</head>
<body>
    <header class="custom-header">
        <div>
            <h1>The Product Report API</h1>
            <div class="subtitle">OpenAPI 3.1 Documentation</div>
        </div>
        <nav class="links">
            <a href="https://theproductreport.org">Website</a>
            <a href="https://brands.theproductreport.org">Brand Portal</a>
            <a href="/api/docs?format=json" target="_blank">Download OpenAPI Spec</a>
        </nav>
    </header>

    <div id="swagger-ui"></div>

    <div id="auth-status" class="auth-status unauthenticated" style="display: none;">
        <span id="auth-icon"></span>
        <span id="auth-text"></span>
    </div>

    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
    <script>
        // Check auth status
        function updateAuthStatus() {
            const statusEl = document.getElementById('auth-status');
            const iconEl = document.getElementById('auth-icon');
            const textEl = document.getElementById('auth-text');
            const token = localStorage.getItem('payload-token');

            if (token) {
                statusEl.className = 'auth-status authenticated';
                iconEl.innerHTML = '&#10003;';
                textEl.textContent = 'Authenticated';
            } else {
                statusEl.className = 'auth-status unauthenticated';
                iconEl.innerHTML = '&#9888;';
                textEl.textContent = 'Not authenticated';
            }
            statusEl.style.display = 'flex';
        }

        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: '/api/docs?format=json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true,
                filter: true,
                displayRequestDuration: true,
                defaultModelsExpandDepth: 2,
                defaultModelExpandDepth: 2,
                docExpansion: "list",
                showExtensions: true,
                showCommonExtensions: true,
                requestInterceptor: (request) => {
                    // Add JWT token if available
                    const token = localStorage.getItem('payload-token');
                    if (token) {
                        request.headers['Authorization'] = 'Bearer ' + token;
                    }

                    // Add fingerprint if available
                    const fingerprint = localStorage.getItem('fingerprint-hash');
                    if (fingerprint) {
                        request.headers['x-fingerprint'] = fingerprint;
                    }

                    return request;
                },
                responseInterceptor: (response) => {
                    // Log rate limit headers for debugging
                    const remaining = response.headers['x-ratelimit-remaining'];
                    if (remaining && parseInt(remaining) < 10) {
                        console.warn('Rate limit warning: ' + remaining + ' requests remaining');
                    }
                    return response;
                }
            });

            updateAuthStatus();
        };

        // Listen for auth changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'payload-token') {
                updateAuthStatus();
            }
        });
    </script>
</body>
</html>
`
    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
    })
}
