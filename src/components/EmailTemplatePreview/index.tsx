'use client'

/**
 * Email Template Preview Component
 *
 * Shows a live preview of the email template in the admin UI.
 * Includes variable substitution and device size toggles.
 */

import React, { useState, useEffect } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

interface EmailTemplatePreviewProps {
  path?: string
}

// Sample data for preview
const sampleData = {
  userName: 'Sarah',
  productName: 'Organic Face Cream',
  brandName: 'CleanBeauty Co',
  weekNumber: 42,
  badgeName: 'First Scan',
}

export const EmailTemplatePreview: React.FC<EmailTemplatePreviewProps> = () => {
  const { id } = useDocumentInfo()
  const [html, setHtml] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [variables, setVariables] = useState(sampleData)

  useEffect(() => {
    if (id) {
      fetchPreview()
    }
  }, [id, variables])

  const fetchPreview = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/email-template-preview?id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate preview')
      }

      const data = await response.json()
      setHtml(data.html)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setLoading(false)
    }
  }

  const handleSendTest = async () => {
    const email = prompt('Enter email address for test send:')
    if (!email) return

    try {
      const response = await fetch('/api/email-template-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: id, email, variables }),
      })

      if (!response.ok) throw new Error('Failed to send test email')

      alert('Test email sent successfully!')
    } catch (err) {
      alert('Failed to send test email')
    }
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.label}>Preview</span>
          <div style={styles.viewToggle}>
            <button
              onClick={() => setViewMode('desktop')}
              style={{
                ...styles.toggleBtn,
                ...(viewMode === 'desktop' ? styles.toggleBtnActive : {}),
              }}
            >
              🖥️ Desktop
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              style={{
                ...styles.toggleBtn,
                ...(viewMode === 'mobile' ? styles.toggleBtnActive : {}),
              }}
            >
              📱 Mobile
            </button>
          </div>
        </div>
        <div style={styles.toolbarRight}>
          <button onClick={fetchPreview} style={styles.refreshBtn}>
            🔄 Refresh
          </button>
          <button onClick={handleSendTest} style={styles.sendTestBtn}>
            📧 Send Test
          </button>
        </div>
      </div>

      {/* Variable Editor */}
      <div style={styles.variableEditor}>
        <span style={styles.variableLabel}>Test Variables:</span>
        <div style={styles.variableInputs}>
          <input
            type="text"
            value={variables.userName}
            onChange={(e) => setVariables({ ...variables, userName: e.target.value })}
            placeholder="User Name"
            style={styles.variableInput}
          />
          <input
            type="text"
            value={variables.productName}
            onChange={(e) => setVariables({ ...variables, productName: e.target.value })}
            placeholder="Product Name"
            style={styles.variableInput}
          />
          <input
            type="text"
            value={variables.brandName}
            onChange={(e) => setVariables({ ...variables, brandName: e.target.value })}
            placeholder="Brand Name"
            style={styles.variableInput}
          />
        </div>
      </div>

      {/* Preview Frame */}
      <div style={styles.previewContainer}>
        {loading ? (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>Generating preview...</span>
          </div>
        ) : error ? (
          <div style={styles.error}>
            <span>⚠️ {error}</span>
            <button onClick={fetchPreview} style={styles.retryBtn}>
              Try Again
            </button>
          </div>
        ) : (
          <div
            style={{
              ...styles.previewFrame,
              maxWidth: viewMode === 'mobile' ? '375px' : '600px',
            }}
          >
            <iframe
              srcDoc={html}
              style={styles.iframe}
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  toolbarRight: {
    display: 'flex',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#334155',
  },
  viewToggle: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    borderRadius: '6px',
    padding: '2px',
  },
  toggleBtn: {
    padding: '6px 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#64748b',
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  refreshBtn: {
    padding: '6px 12px',
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  sendTestBtn: {
    padding: '6px 12px',
    border: 'none',
    background: '#059669',
    color: '#ffffff',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  variableEditor: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
  },
  variableLabel: {
    fontSize: '13px',
    color: '#64748b',
    whiteSpace: 'nowrap',
  },
  variableInputs: {
    display: 'flex',
    gap: '8px',
    flex: 1,
    overflowX: 'auto',
  },
  variableInput: {
    padding: '6px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '120px',
  },
  previewContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '24px',
    overflowY: 'auto',
  },
  previewFrame: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    width: '100%',
    transition: 'max-width 0.2s ease',
  },
  iframe: {
    width: '100%',
    height: '800px',
    border: 'none',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: '#64748b',
    padding: '48px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e2e8f0',
    borderTopColor: '#059669',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    color: '#dc2626',
    padding: '48px',
  },
  retryBtn: {
    padding: '8px 16px',
    border: '1px solid #dc2626',
    background: 'transparent',
    color: '#dc2626',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
}

export default EmailTemplatePreview
