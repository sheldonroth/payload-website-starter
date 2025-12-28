'use client'

import React from 'react'
import Link from 'next/link'

/**
 * Custom navigation links for the admin sidebar
 * These appear at the bottom of the sidebar nav
 */
const AdminNavLinks: React.FC = () => {
    return (
        <>
            <div style={{ padding: '0 12px', marginTop: '8px' }}>
                <div style={{ borderTop: '1px solid #3f3f46', paddingTop: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 600, letterSpacing: '0.5px', marginBottom: '8px', display: 'block' }}>
                        AI CONTENT
                    </span>
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
                        <span>🤖</span>
                        <span>AI Suggestions</span>
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
                        }}
                    >
                        <span>📂</span>
                        <span>Suggested Categories</span>
                    </Link>
                </div>
            </div>
        </>
    )
}

export default AdminNavLinks
