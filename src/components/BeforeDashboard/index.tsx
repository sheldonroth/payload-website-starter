import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to The Product Report CMS</h4>
      </Banner>
      <p style={{ padding: '0 24px', color: '#6e6e73' }}>
        Use the sidebar to manage products, articles, videos, and more.
      </p>
    </div>
  )
}

export default BeforeDashboard
