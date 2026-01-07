'use client'

import React, { useState } from 'react'

interface ExportOption {
  id: string
  name: string
  description: string
  endpoint: string
  format: 'json' | 'csv'
  icon: string
  color: string
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'backup',
    name: 'Full Backup',
    description: 'All products, articles, videos, categories, and users',
    endpoint: '/api/backup/export',
    format: 'json',
    icon: '\u{1F4BE}',
    color: '#10b981',
  },
  {
    id: 'analytics-json',
    name: 'Business Analytics (JSON)',
    description: 'Revenue, trials, churn, referrals, experiments',
    endpoint: '/api/business-analytics/export?format=json',
    format: 'json',
    icon: '\u{1F4CA}',
    color: '#3b82f6',
  },
  {
    id: 'analytics-csv',
    name: 'Business Analytics (CSV)',
    description: 'Same data in spreadsheet format',
    endpoint: '/api/business-analytics/export?format=csv',
    format: 'csv',
    icon: '\u{1F4C4}',
    color: '#8b5cf6',
  },
  {
    id: 'products',
    name: 'Products Only',
    description: 'All product data without other collections',
    endpoint: '/api/products?limit=100000&depth=0',
    format: 'json',
    icon: '\u{1F4E6}',
    color: '#f59e0b',
  },
  {
    id: 'users',
    name: 'Users Export',
    description: 'User list (email, name, subscription status)',
    endpoint: '/api/users?limit=100000&depth=0',
    format: 'json',
    icon: '\u{1F465}',
    color: '#ec4899',
  },
  {
    id: 'audit-log',
    name: 'Audit Log',
    description: 'System activity and action history',
    endpoint: '/api/audit-log?limit=10000&sort=-createdAt',
    format: 'json',
    icon: '\u{1F4DD}',
    color: '#6b7280',
  },
]

const DataExportDashboard: React.FC = () => {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [lastExports, setLastExports] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (option: ExportOption) => {
    setDownloading(option.id)
    setError(null)

    try {
      const response = await fetch(option.endpoint, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Export failed: ${response.status}`)
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const timestamp = new Date().toISOString().split('T')[0]
      const ext = option.format === 'csv' ? 'csv' : 'json'
      const filename = filenameMatch?.[1] || `${option.id}-export-${timestamp}.${ext}`

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Update last export time
      setLastExports((prev) => ({
        ...prev,
        [option.id]: new Date().toLocaleString(),
      }))
    } catch (err) {
      console.error('Export failed:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Data Export</h1>
        <p style={styles.subtitle}>Download CMS data in various formats</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={styles.errorAlert}>
          <span>{'\u26A0'}</span> {error}
          <button onClick={() => setError(null)} style={styles.dismissButton}>
            {'\u2715'}
          </button>
        </div>
      )}

      {/* Export Cards */}
      <div style={styles.grid}>
        {EXPORT_OPTIONS.map((option) => {
          const isDownloading = downloading === option.id
          const lastExport = lastExports[option.id]

          return (
            <div key={option.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={{ fontSize: '32px' }}>{option.icon}</span>
                <div>
                  <h3 style={styles.cardTitle}>{option.name}</h3>
                  <p style={styles.cardDescription}>{option.description}</p>
                </div>
              </div>

              <div style={styles.cardMeta}>
                <span
                  style={{
                    ...styles.formatBadge,
                    backgroundColor: option.format === 'csv' ? '#dcfce7' : '#dbeafe',
                    color: option.format === 'csv' ? '#166534' : '#1e40af',
                  }}
                >
                  {option.format.toUpperCase()}
                </span>
                {lastExport && (
                  <span style={styles.lastExport}>Last: {lastExport}</span>
                )}
              </div>

              <button
                onClick={() => handleExport(option)}
                disabled={isDownloading}
                style={{
                  ...styles.exportButton,
                  backgroundColor: isDownloading ? '#9ca3af' : option.color,
                  cursor: isDownloading ? 'not-allowed' : 'pointer',
                }}
              >
                {isDownloading ? '\u23F3 Downloading...' : '\u2B07 Download'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Info Footer */}
      <div style={styles.footer}>
        <p style={styles.footerText}>
          {'\uD83D\uDCA1'} <strong>Tip:</strong> Store backups in a secure cloud location like Google Drive, Dropbox, or AWS S3.
        </p>
        <p style={styles.footerText}>
          {'\uD83D\uDD12'} All exports are admin-only and require authentication.
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: '14px',
    color: '#6b7280',
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#991b1b',
    fontSize: '14px',
    marginBottom: '24px',
  },
  dismissButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#991b1b',
    fontSize: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  cardDescription: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.4,
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  formatBadge: {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
  },
  lastExport: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  exportButton: {
    width: '100%',
    padding: '12px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    marginTop: 'auto',
  },
  footer: {
    marginTop: '32px',
    padding: '20px',
    background: '#f9fafb',
    borderRadius: '12px',
  },
  footerText: {
    margin: '0 0 8px',
    fontSize: '13px',
    color: '#6b7280',
  },
}

export default DataExportDashboard
