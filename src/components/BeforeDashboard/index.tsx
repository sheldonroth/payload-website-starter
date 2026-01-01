'use client'

import { Banner } from '@payloadcms/ui/elements/Banner'
import React, { useState } from 'react'
import MagicInput from '../MagicInput'
import AIDraftInbox from '../AIDraftInbox'
import VideoToDraft from '../VideoToDraft'
import ChannelSync from '../ChannelSync'
import PollGenerator from '../PollGenerator'
import CategoryPollGenerator from '../CategoryPollGenerator'
import SEOGenerator from '../SEOGenerator'
import ProductEnricher from '../ProductEnricher'
import TikTokSync from '../TikTokSync'
import YouTubeSync from '../YouTubeSync'
import AdminPurge from '../AdminPurge'
import BackupDownload from '../BackupDownload'
import ImageReview from '../ImageReview'
import BatchBackgroundRemoval from '../BatchBackgroundRemoval'
import NewsletterExport from '../NewsletterExport'
import EmailTester from '../EmailTester'

import './index.scss'

const baseClass = 'before-dashboard'

// Collapsible Section Component
const CollapsibleSection: React.FC<{
  title: string
  icon: string
  children: React.ReactNode
  defaultOpen?: boolean
  variant?: 'default' | 'danger'
  badge?: string
}> = ({ title, icon, children, defaultOpen = true, variant = 'default', badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`${baseClass}__section`}>
      <div className={`${baseClass}__section-header ${variant === 'danger' ? `${baseClass}__section-header--danger` : ''}`}>
        <button
          className={`${baseClass}__section-toggle`}
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <span className={`chevron ${!isOpen ? 'chevron--collapsed' : ''}`}>
            {isOpen ? '▼' : '▶'}
          </span>
          <h3>
            <span>{icon}</span>
            {title}
            {badge && (
              <span style={{
                marginLeft: '8px',
                padding: '2px 8px',
                background: '#fef3c7',
                color: '#92400e',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '4px',
              }}>
                {badge}
              </span>
            )}
          </h3>
        </button>
      </div>
      <div
        className={`${baseClass}__section-content ${!isOpen ? `${baseClass}__section-content--collapsed` : ''}`}
        style={{ maxHeight: isOpen ? '10000px' : '0' }}
      >
        {children}
      </div>
    </div>
  )
}

const BeforeDashboard: React.FC = () => {
  return (
    <div className={baseClass}>
      <Banner className={`${baseClass}__banner`} type="success">
        <h4>Welcome to The Product Report CMS</h4>
      </Banner>

      {/* Quick Navigation */}
      <nav className={`${baseClass}__nav`}>
        <a href="/admin" className={`${baseClass}__nav-link ${baseClass}__nav-link--active`}>
          🏠 Home
        </a>
        <a href="/admin/collections/products" className={`${baseClass}__nav-link`}>
          📦 Products
        </a>
        <a href="/admin/collections/investigation-polls" className={`${baseClass}__nav-link`}>
          🗳️ Polls
        </a>
        <a href="/admin/collections/categories" className={`${baseClass}__nav-link`}>
          📂 Categories
        </a>
        <a href="/admin/collections/articles" className={`${baseClass}__nav-link`}>
          📰 Articles
        </a>
        <a href="/admin/collections/videos" className={`${baseClass}__nav-link`}>
          🎬 Videos
        </a>
        <a href="#ai-tools-section" className={`${baseClass}__nav-link ${baseClass}__nav-link--accent`}>
          🤖 AI Tools
        </a>
        <a href="#admin-tools-section" className={`${baseClass}__nav-link`}>
          ⚙️ Admin
        </a>
      </nav>

      <p className={`${baseClass}__help`}>
        Use the sidebar or quick links above to navigate. Click section headers to collapse/expand.
      </p>

      {/* Magic Input - Primary Ingestion */}
      <div id="ai-tools-section">
        <MagicInput />
      </div>

      {/* AI Draft Inbox - Review Queue */}
      <CollapsibleSection title="AI Draft Inbox" icon="&#x1F4E5;" defaultOpen={true}>
        <AIDraftInbox />
      </CollapsibleSection>

      {/* Legacy Content Ingestion Tools (collapsed by default) */}
      <CollapsibleSection title="Advanced Ingestion" icon="&#x1F4E5;" defaultOpen={false}>
        <div className={`${baseClass}__grid`}>
          <YouTubeSync />
          <VideoToDraft />
          <ChannelSync />
          <TikTokSync />
        </div>
      </CollapsibleSection>

      {/* Product Management Tools */}
      <CollapsibleSection title="Product Management" icon="📦" defaultOpen={true}>
        <div className={`${baseClass}__grid`}>
          <ProductEnricher />
          <SEOGenerator />
        </div>
      </CollapsibleSection>

      {/* Community Tools */}
      <CollapsibleSection title="Community & Polls" icon="🗳️" defaultOpen={false}>
        <div className={`${baseClass}__grid`}>
          <PollGenerator />
          <CategoryPollGenerator />
        </div>
      </CollapsibleSection>

      {/* Image Review */}
      <CollapsibleSection title="Image Review" icon="🖼️" defaultOpen={true} badge="20 need images">
        <ImageReview />
      </CollapsibleSection>

      {/* Background Removal */}
      <CollapsibleSection title="Background Removal" icon="✂️" defaultOpen={false} badge="$0.02/image">
        <BatchBackgroundRemoval />
      </CollapsibleSection>

      {/* Admin Tools */}
      <div id="admin-tools-section">
        <CollapsibleSection title="Admin Tools" icon="⚠️" variant="danger" defaultOpen={false}>
          <div className={`${baseClass}__grid`}>
            <EmailTester />
            <NewsletterExport />
            <BackupDownload />
            <AdminPurge />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  )
}

export default BeforeDashboard
