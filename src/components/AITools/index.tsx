'use client'

import React from 'react'
import VideoToDraft from '../VideoToDraft'
import ChannelSync from '../ChannelSync'
import ProductEnricher from '../ProductEnricher'
import TikTokSync from '../TikTokSync'
import SEOGenerator from '../SEOGenerator'
import PollGenerator from '../PollGenerator'
import CategoryPollGenerator from '../CategoryPollGenerator'
import AdminPurge from '../AdminPurge'
import BackupDownload from '../BackupDownload'

/**
 * AI Tools Dashboard - All AI-powered content creation tools
 * This is a custom admin view accessible from the sidebar
 */
const AITools: React.FC = () => {
    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
                    🤖 AI Tools
                </h1>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    AI-powered tools for content creation, analysis, and enrichment
                </p>
            </div>

            {/* Video Analysis Section */}
            <section style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📹 Video Analysis
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                    <VideoToDraft />
                    <ChannelSync />
                    <TikTokSync />
                </div>
            </section>

            {/* Product Tools Section */}
            <section style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📦 Product Tools
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                    <ProductEnricher />
                    <SEOGenerator />
                </div>
            </section>

            {/* Poll Tools Section */}
            <section style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🗳️ Poll Generation
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                    <PollGenerator />
                    <CategoryPollGenerator />
                </div>
            </section>

            {/* Admin Tools Section */}
            <section>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠️ Admin Tools
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                    <BackupDownload />
                    <AdminPurge />
                </div>
            </section>
        </div>
    )
}

export default AITools
