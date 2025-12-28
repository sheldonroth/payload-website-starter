'use client'

import React, { useState } from 'react'

const BackupDownload: React.FC = () => {
    const [downloading, setDownloading] = useState(false)
    const [backingUp, setBackingUp] = useState(false)
    const [lastBackup, setLastBackup] = useState<string | null>(null)
    const [driveStatus, setDriveStatus] = useState<{ success: boolean; message: string } | null>(null)

    const handleDownload = async () => {
        setDownloading(true)
        try {
            const response = await fetch('/api/backup/export', {
                credentials: 'include',
            })

            if (!response.ok) {
                throw new Error('Export failed')
            }

            const contentDisposition = response.headers.get('Content-Disposition')
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
            const filename = filenameMatch?.[1] || `backup_${new Date().toISOString().split('T')[0]}.json`

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            setLastBackup(new Date().toLocaleString())
        } catch (error) {
            console.error('Download failed:', error)
            alert('Backup download failed. Please try again.')
        } finally {
            setDownloading(false)
        }
    }

    const handleBackupToDrive = async () => {
        setBackingUp(true)
        setDriveStatus(null)
        try {
            const response = await fetch('/api/backup/drive', {
                method: 'POST',
                credentials: 'include',
            })

            const data = await response.json()

            if (data.success) {
                setDriveStatus({
                    success: true,
                    message: `✅ Backed up to Drive: ${data.filename}`,
                })
            } else {
                setDriveStatus({
                    success: false,
                    message: `❌ ${data.error || 'Backup failed'}`,
                })
            }
        } catch (error) {
            setDriveStatus({
                success: false,
                message: `❌ ${error instanceof Error ? error.message : 'Network error'}`,
            })
        } finally {
            setBackingUp(false)
        }
    }

    return (
        <div
            style={{
                background: '#fff',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                padding: '24px',
                marginBottom: '24px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '24px' }}>💾</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Data Backup</h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#6e6e73' }}>
                        Download or backup to Google Drive
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                    onClick={handleDownload}
                    disabled={downloading}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: downloading ? '#86868b' : '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: downloading ? 'not-allowed' : 'pointer',
                    }}
                >
                    {downloading ? '⏳ Downloading...' : '⬇️ Download'}
                </button>

                <button
                    onClick={handleBackupToDrive}
                    disabled={backingUp}
                    style={{
                        flex: 1,
                        padding: '12px',
                        background: backingUp ? '#86868b' : '#4285f4',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: backingUp ? 'not-allowed' : 'pointer',
                    }}
                >
                    {backingUp ? '⏳ Uploading...' : '☁️ Backup to Drive'}
                </button>
            </div>

            {lastBackup && (
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#10b981', textAlign: 'center' }}>
                    ✓ Last downloaded: {lastBackup}
                </p>
            )}

            {driveStatus && (
                <p style={{
                    margin: '8px 0 0',
                    fontSize: '12px',
                    color: driveStatus.success ? '#10b981' : '#dc2626',
                    textAlign: 'center'
                }}>
                    {driveStatus.message}
                </p>
            )}

            <p style={{ margin: '12px 0 0', fontSize: '11px', color: '#86868b', textAlign: 'center' }}>
                Auto-backup runs daily at midnight UTC
            </p>
        </div>
    )
}

export default BackupDownload
