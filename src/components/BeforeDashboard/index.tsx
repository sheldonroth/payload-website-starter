import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'
import VideoToDraft from '../VideoToDraft'
import ChannelSync from '../ChannelSync'
import ProductsToReview from '../ProductsToReview'
import PollGenerator from '../PollGenerator'
import CategoryPollGenerator from '../CategoryPollGenerator'
import SEOGenerator from '../SEOGenerator'
import ProductEnricher from '../ProductEnricher'
import TikTokSync from '../TikTokSync'
import AdminPurge from '../AdminPurge'
import BackupDownload from '../BackupDownload'

import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to The Product Report CMS</h4>
      </Banner>

      {/* Quick Navigation */}
      <div style={{ padding: '0 24px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <a
          href="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            background: '#1f2937',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          🏠 Home
        </a>
        <a
          href="/admin/collections/products"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            background: '#f3f4f6',
            color: '#374151',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          📦 Products
        </a>
        <a
          href="/admin/collections/investigation-polls"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            background: '#f3f4f6',
            color: '#374151',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          🗳️ Polls
        </a>
        <a
          href="/admin/collections/categories"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            background: '#f3f4f6',
            color: '#374151',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          📂 Categories
        </a>
        <a
          href="#ai-tools"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('ai-tools-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          🤖 AI Tools
        </a>
      </div>

      <p style={{ padding: '0 24px', color: '#6e6e73', marginBottom: '24px' }}>
        Use the sidebar or quick links above to navigate.
      </p>

      <div style={{ padding: '0 24px' }}>
        {/* AI Tools - First */}
        <div id="ai-tools-section">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
            🤖 AI Tools
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <VideoToDraft />
            <ChannelSync />
            <TikTokSync />
            <ProductEnricher />
            <SEOGenerator />
            <PollGenerator />
            <CategoryPollGenerator />
          </div>
        </div>

        {/* Admin Tools */}
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '32px', marginBottom: '16px', color: '#dc2626' }}>
          ⚠️ Admin Tools
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <BackupDownload />
          <AdminPurge />
        </div>

        {/* Products to Review - Moved to bottom */}
        <div style={{ marginTop: '32px' }}>
          <ProductsToReview />
        </div>
      </div>
    </div>
  )
}

export default BeforeDashboard

