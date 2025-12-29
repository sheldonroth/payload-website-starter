'use client'

import React, { useState, useEffect } from 'react'

interface User {
    id: number
    email: string
    name: string | null
}

type EmailTemplate = 'welcome' | 'password_reset' | 'newsletter' | 'subscription'

const EmailTester: React.FC = () => {
    const [users, setUsers] = useState<User[]>([])
    const [selectedEmail, setSelectedEmail] = useState('')
    const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate>('welcome')
    const [customName, setCustomName] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    // Fetch users on mount
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch('/api/users?limit=50&depth=0&sort=-createdAt')
                if (res.ok) {
                    const data = await res.json()
                    setUsers((data.docs || []).map((u: any) => ({
                        id: u.id,
                        email: u.email,
                        name: u.name || null,
                    })))
                }
            } catch {
                // Silent fail
            }
        }
        fetchUsers()
    }, [])

    const sendTestEmail = async () => {
        if (!selectedEmail) {
            setMessage('❌ Please enter an email address')
            return
        }

        setLoading(true)
        setMessage('Sending...')

        try {
            const res = await fetch('/api/admin/send-test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template: selectedTemplate,
                    email: selectedEmail,
                    name: customName || selectedEmail.split('@')[0],
                }),
            })

            if (res.ok) {
                const data = await res.json()
                setMessage(`✅ ${data.message}`)
            } else {
                const error = await res.json()
                setMessage(`❌ ${error.error || 'Failed to send'}`)
            }
        } catch (err) {
            setMessage(`❌ Error: ${err instanceof Error ? err.message : 'Failed'}`)
        } finally {
            setLoading(false)
        }
    }

    const templates: { value: EmailTemplate; label: string; description: string }[] = [
        { value: 'welcome', label: '👋 Welcome Email', description: 'Seth Godin style welcome message' },
        { value: 'password_reset', label: '🔑 Password Reset', description: 'Password reset link' },
        { value: 'newsletter', label: '📧 Newsletter Confirm', description: 'Newsletter subscription confirmation' },
        { value: 'subscription', label: '💎 Subscription Confirm', description: 'Premium subscription confirmation' },
    ]

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '16px',
        }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                📨 Email Tester
            </h3>

            {/* Template Selection */}
            <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Template
                </label>
                <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value as EmailTemplate)}
                    style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        background: '#fff',
                    }}
                >
                    {templates.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                </select>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    {templates.find(t => t.value === selectedTemplate)?.description}
                </p>
            </div>

            {/* Email Input */}
            <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Send To
                </label>
                <input
                    type="email"
                    value={selectedEmail}
                    onChange={(e) => setSelectedEmail(e.target.value)}
                    placeholder="email@example.com"
                    list="user-emails"
                    style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}
                />
                <datalist id="user-emails">
                    {users.map(u => (
                        <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                    ))}
                </datalist>
            </div>

            {/* Name Override */}
            <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                    Name (optional)
                </label>
                <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Override recipient name"
                    style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                    }}
                />
            </div>

            {/* Send Button */}
            <button
                onClick={sendTestEmail}
                disabled={loading || !selectedEmail}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: loading || !selectedEmail ? '#9ca3af' : '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading || !selectedEmail ? 'not-allowed' : 'pointer',
                }}
            >
                {loading ? 'Sending...' : '📤 Send Test Email'}
            </button>

            {/* Message */}
            {message && (
                <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    background: message.includes('✅') ? '#dcfce7' : '#fef2f2',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: message.includes('✅') ? '#166534' : '#991b1b',
                }}>
                    {message}
                </div>
            )}
        </div>
    )
}

export default EmailTester
