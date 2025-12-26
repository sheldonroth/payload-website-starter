import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'
import VideoToDraft from '../VideoToDraft'

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

      {/* Video-to-Draft Tool */}
      <div style={{ padding: '0 24px' }}>
        <VideoToDraft />
      </div>
    </div>
  )
}

export default BeforeDashboard
