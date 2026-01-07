/**
 * API Documentation Endpoint
 *
 * Serves interactive Swagger UI for API exploration.
 * GET /api/docs - HTML documentation page
 * GET /api/docs?format=json - OpenAPI JSON specification
 */

import { NextResponse } from 'next/server'
import { swaggerSpec } from '../../../../docs/api/swagger.config'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

    // Return JSON spec
    if (format === 'json') {
        return NextResponse.json(swaggerSpec)
    }

    // Return Swagger UI HTML
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Product Report API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body {
            margin: 0;
            padding: 0;
        }
        .swagger-ui .topbar {
            display: none;
        }
        .swagger-ui .info {
            margin: 30px 0;
        }
        .swagger-ui .info .title {
            font-size: 2.5rem;
        }
        .swagger-ui .scheme-container {
            background: #fafafa;
            padding: 20px;
            box-shadow: 0 1px 2px rgba(0,0,0,.1);
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: '/api/docs?format=json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true,
                requestInterceptor: (request) => {
                    // Add any auth headers if available
                    const token = localStorage.getItem('payload-token')
                    if (token) {
                        request.headers['Authorization'] = 'Bearer ' + token
                    }
                    return request
                }
            })
        }
    </script>
</body>
</html>
`
    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html',
        },
    })
}
