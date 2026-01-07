'use client'

import React, { useEffect, useState, useCallback } from 'react'

// External service definitions
const EXTERNAL_SERVICES = [
    {
        id: 'stripe',
        name: 'Stripe',
        category: 'Payments',
        description: 'Subscription billing, invoices, customer management',
        icon: '💳',
        envVars: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
        hasWebhook: true,
        webhookPath: '/api/webhooks/stripe',
        dashboardUrl: 'https://dashboard.stripe.com',
        docsUrl: 'https://docs.stripe.com/api',
        color: '#635bff',
    },
    {
        id: 'resend',
        name: 'Resend',
        category: 'Email',
        description: 'Transactional emails, A/B testing, contact sync',
        icon: '📧',
        envVars: ['RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET'],
        hasWebhook: true,
        webhookPath: '/api/email-webhook',
        dashboardUrl: 'https://resend.com/emails',
        docsUrl: 'https://resend.com/docs',
        color: '#000000',
    },
    {
        id: 'revenuecat',
        name: 'RevenueCat',
        category: 'Subscriptions',
        description: 'Mobile subscription tracking, referral management',
        icon: '🐱',
        envVars: ['REVENUECAT_API_KEY', 'REVENUECAT_WEBHOOK_SECRET'],
        hasWebhook: true,
        webhookPath: '/api/webhooks/revenuecat',
        dashboardUrl: 'https://app.revenuecat.com',
        docsUrl: 'https://docs.revenuecat.com',
        color: '#f25022',
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        category: 'AI/ML',
        description: 'Embeddings, video analysis, content generation',
        icon: '✨',
        envVars: ['GEMINI_API_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://aistudio.google.com',
        docsUrl: 'https://ai.google.dev/docs',
        color: '#4285f4',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        category: 'AI/ML',
        description: 'GPT-4 Vision for label/ingredient analysis',
        icon: '🤖',
        envVars: ['OPENAI_API_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://platform.openai.com',
        docsUrl: 'https://platform.openai.com/docs',
        color: '#10a37f',
    },
    {
        id: 'statsig',
        name: 'Statsig',
        category: 'Experimentation',
        description: 'Feature flags, A/B testing, experiment analytics',
        icon: '🧪',
        envVars: ['STATSIG_CONSOLE_API_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://console.statsig.com',
        docsUrl: 'https://docs.statsig.com',
        color: '#194b7d',
    },
    {
        id: 'mixpanel',
        name: 'Mixpanel',
        category: 'Analytics',
        description: 'Product analytics, conversion funnels, trials',
        icon: '📊',
        envVars: ['MIXPANEL_API_SECRET'],
        hasWebhook: false,
        dashboardUrl: 'https://mixpanel.com',
        docsUrl: 'https://developer.mixpanel.com',
        color: '#7856ff',
    },
    {
        id: 'rudderstack',
        name: 'RudderStack',
        category: 'CDP',
        description: 'Customer data platform, event routing',
        icon: '🚀',
        envVars: ['RUDDERSTACK_SERVER_WRITE_KEY', 'NEXT_PUBLIC_RUDDERSTACK_WRITE_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://app.rudderstack.com',
        docsUrl: 'https://www.rudderstack.com/docs',
        color: '#5c4ee5',
    },
    {
        id: 'sentry',
        name: 'Sentry',
        category: 'Monitoring',
        description: 'Error tracking, performance monitoring, alerts',
        icon: '🐛',
        envVars: ['SENTRY_API_TOKEN', 'SENTRY_WEBHOOK_SECRET'],
        hasWebhook: true,
        webhookPath: '/api/webhooks/sentry',
        dashboardUrl: 'https://sentry.io',
        docsUrl: 'https://docs.sentry.io',
        color: '#362d59',
    },
    {
        id: 'photoroom',
        name: 'Photoroom',
        category: 'Image Processing',
        description: 'Background removal for product images',
        icon: '🖼️',
        envVars: ['PHOTOROOM_API_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://www.photoroom.com',
        docsUrl: 'https://www.photoroom.com/api/docs',
        color: '#ff6b6b',
    },
    {
        id: 'apify',
        name: 'Apify',
        category: 'Scraping',
        description: 'TikTok profile and video scraping',
        icon: '🕷️',
        envVars: ['APIFY_API_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://console.apify.com',
        docsUrl: 'https://docs.apify.com',
        color: '#00b894',
    },
    {
        id: 'fingerprint',
        name: 'FingerprintJS',
        category: 'Identity',
        description: 'Device fingerprinting and identification',
        icon: '🔐',
        envVars: ['NEXT_PUBLIC_FINGERPRINT_API_KEY'],
        hasWebhook: false,
        dashboardUrl: 'https://dashboard.fingerprint.com',
        docsUrl: 'https://dev.fingerprint.com/docs',
        color: '#f76c6c',
    },
    {
        id: 'google-search',
        name: 'Google CSE',
        category: 'Search',
        description: 'Product image search and discovery',
        icon: '🔍',
        envVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_CSE_ID'],
        hasWebhook: false,
        dashboardUrl: 'https://programmablesearchengine.google.com',
        docsUrl: 'https://developers.google.com/custom-search',
        color: '#4285f4',
    },
    {
        id: 'google-oauth',
        name: 'Google OAuth',
        category: 'Auth',
        description: 'Social login authentication',
        icon: '🔑',
        envVars: ['GOOGLE_CLIENT_SECRET'],
        hasWebhook: false,
        dashboardUrl: 'https://console.cloud.google.com/apis/credentials',
        docsUrl: 'https://developers.google.com/identity',
        color: '#ea4335',
    },
    {
        id: 'apple-oauth',
        name: 'Apple Sign In',
        category: 'Auth',
        description: 'Apple social login authentication',
        icon: '🍎',
        envVars: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID'],
        hasWebhook: false,
        dashboardUrl: 'https://developer.apple.com',
        docsUrl: 'https://developer.apple.com/sign-in-with-apple',
        color: '#000000',
    },
]

// Internal API endpoint categories
const INTERNAL_ENDPOINTS = [
    {
        category: 'Mobile APIs',
        icon: '📱',
        color: '#3b82f6',
        endpoints: [
            { name: 'Scanner Lookup', path: '/api/scanner/lookup', method: 'POST' },
            { name: 'Smart Scan', path: '/api/smart-scan', method: 'POST' },
            { name: 'Product Report', path: '/api/product-report/:barcode', method: 'GET' },
            { name: 'Scout Profile', path: '/api/scout-profile/:slug', method: 'GET' },
            { name: 'My Scout Stats', path: '/api/my-scout-stats', method: 'GET' },
            { name: 'Feedback', path: '/api/feedback', method: 'POST' },
            { name: 'Push Tokens', path: '/api/push-tokens', method: 'POST' },
        ],
    },
    {
        category: 'Brand Portal APIs',
        icon: '🏢',
        color: '#8b5cf6',
        endpoints: [
            { name: 'Brand Login', path: '/api/brand-auth/login', method: 'POST' },
            { name: 'Brand Signup', path: '/api/brand-auth/signup', method: 'POST' },
            { name: 'Brand Analytics', path: '/api/brand/:id/analytics', method: 'GET' },
            { name: 'Brand Products', path: '/api/brand/:id/products', method: 'GET' },
            { name: 'Subscription Plans', path: '/api/brand/subscription/plans', method: 'GET' },
            { name: 'Create Checkout', path: '/api/brand/subscription/create-checkout', method: 'POST' },
        ],
    },
    {
        category: 'User APIs',
        icon: '👤',
        color: '#10b981',
        endpoints: [
            { name: 'User Profile', path: '/api/users/me', method: 'GET' },
            { name: 'Email Preferences', path: '/api/email-preferences', method: 'GET/POST' },
            { name: 'Saved Products', path: '/api/users/me/saved-products', method: 'GET' },
            { name: 'Saved Articles', path: '/api/users/me/saved-articles', method: 'GET' },
            { name: 'Referrals', path: '/api/referrals', method: 'GET' },
        ],
    },
    {
        category: 'Admin APIs',
        icon: '⚙️',
        color: '#f59e0b',
        endpoints: [
            { name: 'Business Analytics', path: '/api/business-analytics', method: 'GET' },
            { name: 'Video Analyze', path: '/api/video-analyze', method: 'POST' },
            { name: 'TikTok Analyze', path: '/api/tiktok-analyze', method: 'POST' },
            { name: 'Content Generator', path: '/api/content-generator', method: 'POST' },
            { name: 'AI Assistant', path: '/api/ai-assistant', method: 'POST' },
            { name: 'Background Remove', path: '/api/background-remove', method: 'POST' },
        ],
    },
    {
        category: 'Email & Cron',
        icon: '📬',
        color: '#ec4899',
        endpoints: [
            { name: 'Email Cron', path: '/api/email-cron', method: 'GET' },
            { name: 'Weekly Digest', path: '/api/cron/weekly-digest', method: 'GET' },
            { name: 'Trending Notifications', path: '/api/cron/trending-notifications', method: 'GET' },
            { name: 'Generate Embeddings', path: '/api/cron/generate-embeddings', method: 'GET' },
        ],
    },
    {
        category: 'Webhooks (Incoming)',
        icon: '🔔',
        color: '#ef4444',
        endpoints: [
            { name: 'Stripe Webhook', path: '/api/webhooks/stripe', method: 'POST' },
            { name: 'RevenueCat Webhook', path: '/api/webhooks/revenuecat', method: 'POST' },
            { name: 'Sentry Webhook', path: '/api/webhooks/sentry', method: 'POST' },
            { name: 'Resend Webhook', path: '/api/email-webhook', method: 'POST' },
        ],
    },
]

interface ServiceStatus {
    id: string
    status: 'healthy' | 'degraded' | 'down' | 'unknown'
    lastChecked?: Date
    error?: string
}

const APIConnectionsDashboard: React.FC = () => {
    const [serviceStatuses, setServiceStatuses] = useState<Record<string, ServiceStatus>>({})
    const [loading, setLoading] = useState(true)
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
    const [selectedService, setSelectedService] = useState<typeof EXTERNAL_SERVICES[0] | null>(null)

    const checkServiceStatuses = useCallback(async () => {
        try {
            const response = await fetch('/api/api-status', { credentials: 'include' })
            if (response.ok) {
                const data = await response.json()
                setServiceStatuses(data.services || {})
            }
        } catch (err) {
            console.error('Failed to fetch service statuses:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkServiceStatuses()
        const interval = setInterval(checkServiceStatuses, 60000) // Check every minute
        return () => clearInterval(interval)
    }, [checkServiceStatuses])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return '#10b981'
            case 'degraded': return '#f59e0b'
            case 'down': return '#ef4444'
            default: return '#9ca3af'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'healthy': return 'Healthy'
            case 'degraded': return 'Degraded'
            case 'down': return 'Down'
            default: return 'Unknown'
        }
    }

    const categorizedServices = EXTERNAL_SERVICES.reduce((acc, service) => {
        if (!acc[service.category]) acc[service.category] = []
        acc[service.category].push(service)
        return acc
    }, {} as Record<string, typeof EXTERNAL_SERVICES>)

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>API Connections</h1>
                    <p style={styles.subtitle}>
                        Visualize all external integrations and internal API endpoints
                    </p>
                </div>
                <div style={styles.headerActions}>
                    <a
                        href="/api/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.docsButton}
                    >
                        📚 API Documentation
                    </a>
                    <button style={styles.refreshButton} onClick={checkServiceStatuses}>
                        🔄 Refresh Status
                    </button>
                </div>
            </div>

            {/* Architecture Diagram */}
            <div style={styles.architectureSection}>
                <h2 style={styles.sectionTitle}>System Architecture</h2>
                <div style={styles.architectureDiagram}>
                    {/* Mobile App Flow */}
                    <div style={styles.flowColumn}>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>📱</span>
                            <span style={styles.flowLabel}>Mobile App</span>
                        </div>
                        <div style={styles.flowArrow}>↓</div>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>🔐</span>
                            <span style={styles.flowLabel}>Fingerprint Auth</span>
                        </div>
                    </div>

                    {/* Brand Portal Flow */}
                    <div style={styles.flowColumn}>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>🏢</span>
                            <span style={styles.flowLabel}>Brand Portal</span>
                        </div>
                        <div style={styles.flowArrow}>↓</div>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>🔑</span>
                            <span style={styles.flowLabel}>JWT Auth</span>
                        </div>
                    </div>

                    {/* Central Backend */}
                    <div style={styles.centralBox}>
                        <span style={styles.centralIcon}>⚡</span>
                        <span style={styles.centralLabel}>Payload CMS Backend</span>
                        <span style={styles.centralSubtext}>Next.js + PostgreSQL</span>
                    </div>

                    {/* External Services */}
                    <div style={styles.flowColumn}>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>💳</span>
                            <span style={styles.flowLabel}>Payments</span>
                            <span style={styles.flowSubtext}>Stripe</span>
                        </div>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>✨</span>
                            <span style={styles.flowLabel}>AI/ML</span>
                            <span style={styles.flowSubtext}>Gemini + OpenAI</span>
                        </div>
                    </div>

                    {/* Analytics Flow */}
                    <div style={styles.flowColumn}>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>📊</span>
                            <span style={styles.flowLabel}>Analytics</span>
                            <span style={styles.flowSubtext}>Mixpanel + RudderStack</span>
                        </div>
                        <div style={styles.flowBox}>
                            <span style={styles.flowIcon}>📧</span>
                            <span style={styles.flowLabel}>Email</span>
                            <span style={styles.flowSubtext}>Resend</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* External Services Grid */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>External Services ({EXTERNAL_SERVICES.length})</h2>
                <div style={styles.servicesGrid}>
                    {Object.entries(categorizedServices).map(([category, services]) => (
                        <div key={category} style={styles.categoryCard}>
                            <h3 style={styles.categoryTitle}>{category}</h3>
                            <div style={styles.serviceList}>
                                {services.map((service) => {
                                    const status = serviceStatuses[service.id]?.status || 'unknown'
                                    return (
                                        <div
                                            key={service.id}
                                            style={styles.serviceItem}
                                            onClick={() => setSelectedService(service)}
                                        >
                                            <div style={styles.serviceLeft}>
                                                <span style={styles.serviceIcon}>{service.icon}</span>
                                                <div>
                                                    <div style={styles.serviceName}>{service.name}</div>
                                                    <div style={styles.serviceDesc}>{service.description}</div>
                                                </div>
                                            </div>
                                            <div style={styles.serviceRight}>
                                                <div
                                                    style={{
                                                        ...styles.statusDot,
                                                        backgroundColor: getStatusColor(status),
                                                    }}
                                                    title={getStatusLabel(status)}
                                                />
                                                {service.hasWebhook && (
                                                    <span style={styles.webhookBadge}>Webhook</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Internal Endpoints */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Internal API Endpoints</h2>
                <div style={styles.endpointsGrid}>
                    {INTERNAL_ENDPOINTS.map((group) => (
                        <div key={group.category} style={styles.endpointCard}>
                            <div
                                style={{
                                    ...styles.endpointHeader,
                                    borderLeftColor: group.color,
                                }}
                                onClick={() =>
                                    setExpandedCategory(
                                        expandedCategory === group.category ? null : group.category
                                    )
                                }
                            >
                                <span style={styles.endpointIcon}>{group.icon}</span>
                                <span style={styles.endpointTitle}>{group.category}</span>
                                <span style={styles.endpointCount}>
                                    {group.endpoints.length} endpoints
                                </span>
                                <span style={styles.expandIcon}>
                                    {expandedCategory === group.category ? '▼' : '▶'}
                                </span>
                            </div>
                            {expandedCategory === group.category && (
                                <div style={styles.endpointList}>
                                    {group.endpoints.map((endpoint) => (
                                        <div key={endpoint.path} style={styles.endpointItem}>
                                            <span
                                                style={{
                                                    ...styles.methodBadge,
                                                    backgroundColor:
                                                        endpoint.method === 'GET'
                                                            ? '#10b981'
                                                            : endpoint.method === 'POST'
                                                            ? '#3b82f6'
                                                            : '#f59e0b',
                                                }}
                                            >
                                                {endpoint.method}
                                            </span>
                                            <span style={styles.endpointName}>{endpoint.name}</span>
                                            <code style={styles.endpointPath}>{endpoint.path}</code>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Links */}
            <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Quick Links</h2>
                <div style={styles.quickLinksGrid}>
                    <a href="/api/docs" style={styles.quickLink} target="_blank" rel="noopener noreferrer">
                        <span style={styles.quickLinkIcon}>📚</span>
                        <div>
                            <div style={styles.quickLinkTitle}>API Documentation</div>
                            <div style={styles.quickLinkDesc}>Interactive Swagger UI</div>
                        </div>
                    </a>
                    <a href="/admin/business-analytics" style={styles.quickLink}>
                        <span style={styles.quickLinkIcon}>📊</span>
                        <div>
                            <div style={styles.quickLinkTitle}>Business Analytics</div>
                            <div style={styles.quickLinkDesc}>Revenue & subscriptions</div>
                        </div>
                    </a>
                    <a href="/admin/email-analytics" style={styles.quickLink}>
                        <span style={styles.quickLinkIcon}>📧</span>
                        <div>
                            <div style={styles.quickLinkTitle}>Email Analytics</div>
                            <div style={styles.quickLinkDesc}>Campaign performance</div>
                        </div>
                    </a>
                    <a href="/admin/statsig" style={styles.quickLink}>
                        <span style={styles.quickLinkIcon}>🧪</span>
                        <div>
                            <div style={styles.quickLinkTitle}>Experiments</div>
                            <div style={styles.quickLinkDesc}>A/B test results</div>
                        </div>
                    </a>
                    <a href="/admin/performance" style={styles.quickLink}>
                        <span style={styles.quickLinkIcon}>⚡</span>
                        <div>
                            <div style={styles.quickLinkTitle}>Performance</div>
                            <div style={styles.quickLinkDesc}>API response times</div>
                        </div>
                    </a>
                    <a href="/admin/system-health" style={styles.quickLink}>
                        <span style={styles.quickLinkIcon}>🏥</span>
                        <div>
                            <div style={styles.quickLinkTitle}>System Health</div>
                            <div style={styles.quickLinkDesc}>Status & monitoring</div>
                        </div>
                    </a>
                </div>
            </div>

            {/* Service Detail Modal */}
            {selectedService && (
                <div style={styles.modalOverlay} onClick={() => setSelectedService(null)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <button
                            style={styles.modalClose}
                            onClick={() => setSelectedService(null)}
                        >
                            ✕
                        </button>
                        <div style={styles.modalHeader}>
                            <span style={styles.modalIcon}>{selectedService.icon}</span>
                            <h2 style={styles.modalTitle}>{selectedService.name}</h2>
                        </div>
                        <p style={styles.modalDesc}>{selectedService.description}</p>

                        <div style={styles.modalSection}>
                            <h4 style={styles.modalSectionTitle}>Environment Variables</h4>
                            <div style={styles.envVarList}>
                                {selectedService.envVars.map((v) => (
                                    <code key={v} style={styles.envVar}>{v}</code>
                                ))}
                            </div>
                        </div>

                        {selectedService.hasWebhook && (
                            <div style={styles.modalSection}>
                                <h4 style={styles.modalSectionTitle}>Webhook Endpoint</h4>
                                <code style={styles.webhookPath}>{selectedService.webhookPath}</code>
                            </div>
                        )}

                        <div style={styles.modalActions}>
                            <a
                                href={selectedService.dashboardUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={styles.modalButton}
                            >
                                Open Dashboard →
                            </a>
                            <a
                                href={selectedService.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ ...styles.modalButton, ...styles.modalButtonSecondary }}
                            >
                                View Docs
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px',
    },
    title: {
        margin: 0,
        fontSize: '28px',
        fontWeight: 700,
        color: '#111827',
    },
    subtitle: {
        margin: '4px 0 0 0',
        fontSize: '14px',
        color: '#6b7280',
    },
    headerActions: {
        display: 'flex',
        gap: '12px',
    },
    docsButton: {
        padding: '10px 16px',
        backgroundColor: '#3b82f6',
        color: '#fff',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    refreshButton: {
        padding: '10px 16px',
        backgroundColor: '#f3f4f6',
        color: '#374151',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    architectureSection: {
        marginBottom: '32px',
    },
    sectionTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: '#111827',
        marginBottom: '16px',
    },
    architectureDiagram: {
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '32px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        gap: '24px',
        flexWrap: 'wrap',
    },
    flowColumn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
    },
    flowBox: {
        padding: '16px 24px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        textAlign: 'center',
        minWidth: '120px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    flowIcon: {
        display: 'block',
        fontSize: '24px',
        marginBottom: '4px',
    },
    flowLabel: {
        display: 'block',
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    flowSubtext: {
        display: 'block',
        fontSize: '11px',
        color: '#6b7280',
        marginTop: '2px',
    },
    flowArrow: {
        fontSize: '20px',
        color: '#9ca3af',
    },
    centralBox: {
        padding: '24px 32px',
        backgroundColor: '#3b82f6',
        borderRadius: '12px',
        textAlign: 'center',
        color: '#fff',
        minWidth: '200px',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    },
    centralIcon: {
        display: 'block',
        fontSize: '32px',
        marginBottom: '8px',
    },
    centralLabel: {
        display: 'block',
        fontSize: '16px',
        fontWeight: 700,
    },
    centralSubtext: {
        display: 'block',
        fontSize: '12px',
        opacity: 0.8,
        marginTop: '4px',
    },
    section: {
        marginBottom: '32px',
    },
    servicesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '20px',
    },
    categoryCard: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
    },
    categoryTitle: {
        margin: 0,
        padding: '16px 20px',
        fontSize: '14px',
        fontWeight: 600,
        color: '#374151',
        backgroundColor: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
    },
    serviceList: {
        padding: '8px',
    },
    serviceItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
    },
    serviceLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    serviceIcon: {
        fontSize: '24px',
    },
    serviceName: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    serviceDesc: {
        fontSize: '12px',
        color: '#6b7280',
        marginTop: '2px',
    },
    serviceRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    statusDot: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
    },
    webhookBadge: {
        fontSize: '10px',
        padding: '2px 6px',
        backgroundColor: '#fef3c7',
        color: '#92400e',
        borderRadius: '4px',
        fontWeight: 500,
    },
    endpointsGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    endpointCard: {
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
    },
    endpointHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '16px 20px',
        gap: '12px',
        cursor: 'pointer',
        borderLeft: '4px solid',
        transition: 'background-color 0.15s',
    },
    endpointIcon: {
        fontSize: '20px',
    },
    endpointTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
        flex: 1,
    },
    endpointCount: {
        fontSize: '12px',
        color: '#6b7280',
    },
    expandIcon: {
        fontSize: '10px',
        color: '#9ca3af',
    },
    endpointList: {
        padding: '8px 20px 16px',
        borderTop: '1px solid #f3f4f6',
    },
    endpointItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 0',
    },
    methodBadge: {
        fontSize: '10px',
        fontWeight: 600,
        padding: '3px 6px',
        borderRadius: '4px',
        color: '#fff',
        minWidth: '40px',
        textAlign: 'center',
    },
    endpointName: {
        fontSize: '13px',
        fontWeight: 500,
        color: '#374151',
        minWidth: '140px',
    },
    endpointPath: {
        fontSize: '12px',
        color: '#6b7280',
        backgroundColor: '#f3f4f6',
        padding: '2px 8px',
        borderRadius: '4px',
    },
    quickLinksGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
    },
    quickLink: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        textDecoration: 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s',
    },
    quickLinkIcon: {
        fontSize: '28px',
    },
    quickLinkTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    quickLinkDesc: {
        fontSize: '12px',
        color: '#6b7280',
    },
    // Modal styles
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
    modal: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '480px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto',
        position: 'relative',
    },
    modalClose: {
        position: 'absolute',
        top: '16px',
        right: '16px',
        background: 'none',
        border: 'none',
        fontSize: '20px',
        cursor: 'pointer',
        color: '#6b7280',
    },
    modalHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px',
    },
    modalIcon: {
        fontSize: '32px',
    },
    modalTitle: {
        margin: 0,
        fontSize: '20px',
        fontWeight: 700,
        color: '#111827',
    },
    modalDesc: {
        margin: '0 0 20px 0',
        fontSize: '14px',
        color: '#6b7280',
    },
    modalSection: {
        marginBottom: '16px',
    },
    modalSectionTitle: {
        margin: '0 0 8px 0',
        fontSize: '12px',
        fontWeight: 600,
        color: '#374151',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    envVarList: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
    },
    envVar: {
        fontSize: '12px',
        backgroundColor: '#f3f4f6',
        padding: '4px 10px',
        borderRadius: '4px',
        color: '#374151',
    },
    webhookPath: {
        display: 'block',
        fontSize: '13px',
        backgroundColor: '#fef3c7',
        padding: '8px 12px',
        borderRadius: '6px',
        color: '#92400e',
    },
    modalActions: {
        display: 'flex',
        gap: '12px',
        marginTop: '20px',
    },
    modalButton: {
        flex: 1,
        padding: '12px',
        backgroundColor: '#3b82f6',
        color: '#fff',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        textAlign: 'center',
        border: 'none',
        cursor: 'pointer',
    },
    modalButtonSecondary: {
        backgroundColor: '#f3f4f6',
        color: '#374151',
    },
}

export default APIConnectionsDashboard
