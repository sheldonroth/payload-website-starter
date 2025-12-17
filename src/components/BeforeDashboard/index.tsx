import { Banner } from '@payloadcms/ui/elements/Banner'
import React from 'react'

import './index.scss'

const baseClass = 'before-dashboard'

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to The Product Report CMS 👋</h4>
      </Banner>
      <div className={`${baseClass}__quick-actions`}>
        <h3>Quick Actions</h3>
        <div className={`${baseClass}__grid`}>
          <a href="/admin/collections/products/create" className={`${baseClass}__action-card`}>
            <span className={`${baseClass}__icon`}>📦</span>
            <span className={`${baseClass}__action-title`}>Add Product</span>
            <span className={`${baseClass}__action-desc`}>Create a new product review</span>
          </a>
          <a href="/admin/collections/articles/create" className={`${baseClass}__action-card`}>
            <span className={`${baseClass}__icon`}>📝</span>
            <span className={`${baseClass}__action-title`}>Write Article</span>
            <span className={`${baseClass}__action-desc`}>Publish research or news</span>
          </a>
          <a href="/admin/collections/videos/create" className={`${baseClass}__action-card`}>
            <span className={`${baseClass}__icon`}>🎬</span>
            <span className={`${baseClass}__action-title`}>Add Video</span>
            <span className={`${baseClass}__action-desc`}>Link a YouTube video review</span>
          </a>
          <a href="https://www.theproductreport.org" target="_blank" className={`${baseClass}__action-card`}>
            <span className={`${baseClass}__icon`}>🌐</span>
            <span className={`${baseClass}__action-title`}>View Website</span>
            <span className={`${baseClass}__action-desc`}>See your live site</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default BeforeDashboard
