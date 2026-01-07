'use client'

import React from 'react'
import Link from 'next/link'

/**
 * Custom navigation links for the admin sidebar
 * These appear at the bottom of the sidebar nav under "AI" group
 */
const AdminNavLinks: React.FC = () => {
    return (
        <>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        MODERATION
                    </span>
                    <Link
                        href="/admin/content-moderation"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Content Queue
                    </Link>
                    <Link
                        href="/admin/system-health"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        System Health
                    </Link>
                    <Link
                        href="/admin/activity-feed"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Activity Feed
                    </Link>
                    <Link
                        href="/admin/data-export"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Data Export
                    </Link>
                    <Link
                        href="/admin/api-status"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        API Status
                    </Link>
                    <Link
                        href="/admin/cache-status"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Cache Status
                    </Link>
                </div>
            </div>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        AI
                    </span>
                    <Link
                        href="/admin/ai-draft-inbox"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        AI Draft Inbox
                    </Link>
                    <Link
                        href="/admin/ai-suggestions"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        AI Suggestions
                    </Link>
                    <Link
                        href="/admin/suggested-categories"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Suggested Categories
                    </Link>
                    <Link
                        href="/admin/analytics"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Analytics
                    </Link>
                    <Link
                        href="/admin/business-analytics"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Business Analytics
                    </Link>
                    <Link
                        href="/admin/ai-assistant"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(59, 130, 246, 0.15))',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                        }}
                    >
                        🤖 AI Assistant
                    </Link>
                </div>
            </div>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        EMAIL
                    </span>
                    <Link
                        href="/admin/email-analytics"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        📊 Email Analytics
                    </Link>
                    <Link
                        href="/admin/collections/email-templates"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        ✉️ Templates
                    </Link>
                    <Link
                        href="/admin/collections/email-sends"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        📬 Sent Emails
                    </Link>
                </div>
            </div>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        GROWTH
                    </span>
                    <Link
                        href="/admin/statsig-experiments"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Statsig Experiments
                    </Link>
                    <Link
                        href="/admin/user-analytics"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        User Analytics
                    </Link>
                    <Link
                        href="/admin/product-engagement"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Product Engagement
                    </Link>
                </div>
            </div>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        COMMUNITY
                    </span>
                    <Link
                        href="/admin/scout-leaderboard"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Scout Leaderboard
                    </Link>
                </div>
            </div>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        CONTENT
                    </span>
                    <Link
                        href="/admin/seo-audit"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        SEO Audit
                    </Link>
                    <Link
                        href="/admin/security"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            color: '#d4d4d8',
                            fontSize: '14px',
                            marginBottom: '4px',
                        }}
                    >
                        Security
                    </Link>
                </div>
            </div>
        </>
    )
}

export default AdminNavLinks
