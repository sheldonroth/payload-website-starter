import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'
import ProductsToReview from '../ProductsToReview'

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
        {/* AI Tools Button - Prominent */}
        <a
          href="/admin/ai-tools"
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
        Use the sidebar or quick links above to navigate. AI-powered tools are in the <strong>AI Tools</strong> section.
      </p>

      <div style={{ padding: '0 24px' }}>
        {/* Products to Review - Keep this on homepage since it's the main review workflow */}
        <ProductsToReview />
      </div>
    </div>
  )
}

export default BeforeDashboard

