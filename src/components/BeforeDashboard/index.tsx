import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'
import VideoToDraft from '../VideoToDraft'
import ChannelSync from '../ChannelSync'
import ProductsToReview from '../ProductsToReview'
import PollGenerator from '../PollGenerator'
import SEOGenerator from '../SEOGenerator'

import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to The Product Report CMS</h4>
      </Banner>
      <p style={{ padding: '0 24px', color: '#6e6e73', marginBottom: '24px' }}>
        Use the sidebar to manage products, articles, videos, and more.
      </p>

      <div style={{ padding: '0 24px' }}>
        {/* Products to Review */}
        <ProductsToReview />

        {/* AI Tools */}
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
          🤖 AI Tools
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Single Video Analysis */}
          <VideoToDraft />

          {/* Channel Sync */}
          <ChannelSync />

          {/* Poll Generator */}
          <PollGenerator />

          {/* SEO Generator */}
          <SEOGenerator />
        </div>
      </div>
    </div>
  )
}

export default BeforeDashboard
