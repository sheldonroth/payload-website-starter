'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type {
    ChatMessage,
    Insight,
    AIResponse,
    AnalysisType,
    ModelType,
} from './types'
import { MODEL_OPTIONS, QUICK_PROMPTS } from './types'

// LocalStorage key for chat history
const CHAT_STORAGE_KEY = 'ai-assistant-chat-history'
const MAX_MESSAGES = 20

/**
 * AI Business Assistant - Main Component
 *
 * Provides AI-powered business intelligence analysis with:
 * - Auto-generated insight cards on page load
 * - Interactive chat interface
 * - Quick prompt buttons
 * - Model selection
 */
const AIBusinessAssistant: React.FC = () => {
    // State
    const [insights, setInsights] = useState<Insight[]>([])
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [inputValue, setInputValue] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(true)
    const [selectedModel, setSelectedModel] = useState<ModelType>('gemini-3-pro-preview')
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)

    const chatEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Load chat history from localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(CHAT_STORAGE_KEY)
            if (saved) {
                try {
                    setChatMessages(JSON.parse(saved))
                } catch {
                    console.error('Failed to parse chat history')
                }
            }
        }
    }, [])

    // Save chat history to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && chatMessages.length > 0) {
            const toSave = chatMessages.slice(-MAX_MESSAGES)
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave))
        }
    }, [chatMessages])

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [chatMessages])

    // Auto-analyze on mount
    useEffect(() => {
        generateInsights('full')
    }, [])

    /**
     * Generate insights via API
     */
    const generateInsights = useCallback(async (analysisType: AnalysisType = 'full') => {
        setIsAnalyzing(true)
        setError(null)

        try {
            const response = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'analyze',
                    analysisType,
                    model: selectedModel,
                }),
            })

            const data: AIResponse = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed')
            }

            if (data.insights) {
                setInsights(data.insights)
            }

            setLastUpdated(new Date().toLocaleTimeString())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate insights')
        } finally {
            setIsAnalyzing(false)
        }
    }, [selectedModel])

    /**
     * Send chat message
     */
    const sendMessage = useCallback(async (message?: string) => {
        const text = message || inputValue.trim()
        if (!text || isLoading) return

        setInputValue('')
        setError(null)
        setIsLoading(true)

        // Add user message
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        }
        setChatMessages(prev => [...prev, userMessage])

        try {
            const response = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    action: 'chat',
                    prompt: text,
                    conversationHistory: chatMessages.slice(-10),
                    model: selectedModel,
                }),
            })

            const data: AIResponse = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Chat failed')
            }

            // Add assistant message
            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.message,
                timestamp: new Date().toISOString(),
            }
            setChatMessages(prev => [...prev, assistantMessage])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message')
        } finally {
            setIsLoading(false)
        }
    }, [inputValue, isLoading, chatMessages, selectedModel])

    /**
     * Handle quick prompt click
     */
    const handleQuickPrompt = useCallback((type: AnalysisType) => {
        const prompts: Record<AnalysisType, string> = {
            revenue: 'Analyze our revenue metrics and suggest strategies to grow MRR.',
            churn: 'Deep dive into our churn metrics. What patterns do you see and how can we improve retention?',
            experiments: 'Review our A/B tests. Which should we ship and what new experiments do you recommend?',
            referrals: 'Analyze our referral program. What\'s working and what can be improved?',
            email: 'Review our email performance. How can we improve open and click rates?',
            full: 'Provide a comprehensive business health check with top opportunities and risks.',
        }
        sendMessage(prompts[type])
    }, [sendMessage])

    /**
     * Clear chat history
     */
    const clearChat = useCallback(() => {
        setChatMessages([])
        if (typeof window !== 'undefined') {
            localStorage.removeItem(CHAT_STORAGE_KEY)
        }
    }, [])

    /**
     * Handle keyboard shortcuts
     */
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>AI Business Assistant</h1>
                    <p style={styles.subtitle}>
                        {lastUpdated ? `Last updated: ${lastUpdated}` : 'Analyzing your business data...'}
                    </p>
                </div>
                <div style={styles.headerActions}>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as ModelType)}
                        style={styles.modelSelect}
                    >
                        {MODEL_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => generateInsights('full')}
                        disabled={isAnalyzing}
                        style={styles.refreshButton}
                    >
                        {isAnalyzing ? 'Analyzing...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div style={styles.errorBanner}>
                    {error}
                    <button onClick={() => setError(null)} style={styles.errorDismiss}>x</button>
                </div>
            )}

            {/* Insight Cards */}
            <div style={styles.insightsGrid}>
                {isAnalyzing && insights.length === 0 ? (
                    // Loading skeletons
                    [1, 2, 3].map(i => (
                        <div key={i} style={styles.insightCardSkeleton}>
                            <div style={styles.skeletonTitle} />
                            <div style={styles.skeletonText} />
                            <div style={styles.skeletonText} />
                        </div>
                    ))
                ) : (
                    insights.map((insight, idx) => (
                        <div
                            key={idx}
                            style={{
                                ...styles.insightCard,
                                borderLeftColor: getPriorityColor(insight.priority),
                            }}
                        >
                            <div style={styles.insightHeader}>
                                <span style={{
                                    ...styles.priorityBadge,
                                    backgroundColor: getPriorityColor(insight.priority),
                                }}>
                                    {insight.priority}
                                </span>
                                <span style={styles.categoryBadge}>{insight.category}</span>
                            </div>
                            <h3 style={styles.insightTitle}>{insight.title}</h3>
                            {insight.metric && (
                                <div style={styles.metricDisplay}>
                                    <span style={styles.metricValue}>{insight.metric}</span>
                                    {insight.change !== undefined && (
                                        <span style={{
                                            ...styles.changeIndicator,
                                            color: insight.change >= 0 ? '#22c55e' : '#ef4444',
                                        }}>
                                            {insight.change >= 0 ? '+' : ''}{insight.change}%
                                        </span>
                                    )}
                                </div>
                            )}
                            <p style={styles.insightSummary}>{insight.summary}</p>
                            {insight.recommendations.length > 0 && (
                                <ul style={styles.recommendations}>
                                    {insight.recommendations.slice(0, 2).map((rec, i) => (
                                        <li key={i} style={styles.recommendation}>{rec}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Quick Prompts */}
            <div style={styles.quickPromptsSection}>
                <span style={styles.quickPromptsLabel}>Quick Analysis:</span>
                <div style={styles.quickPromptsRow}>
                    {QUICK_PROMPTS.map(prompt => (
                        <button
                            key={prompt.type}
                            onClick={() => handleQuickPrompt(prompt.type)}
                            disabled={isLoading}
                            style={styles.quickPromptButton}
                        >
                            <span style={styles.quickPromptIcon}>{prompt.icon}</span>
                            {prompt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Section */}
            <div style={styles.chatSection}>
                <div style={styles.chatHeader}>
                    <h2 style={styles.chatTitle}>Chat</h2>
                    {chatMessages.length > 0 && (
                        <button onClick={clearChat} style={styles.clearChatButton}>
                            Clear History
                        </button>
                    )}
                </div>

                <div style={styles.chatMessages}>
                    {chatMessages.length === 0 ? (
                        <div style={styles.emptyChat}>
                            Ask me anything about your business metrics, growth strategies, or optimization opportunities.
                        </div>
                    ) : (
                        chatMessages.map(msg => (
                            <div
                                key={msg.id}
                                style={{
                                    ...styles.chatMessage,
                                    ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                                }}
                            >
                                <div style={styles.messageRole}>
                                    {msg.role === 'user' ? 'You' : 'AI'}
                                </div>
                                <div style={styles.messageContent}>
                                    {msg.content.split('\n').map((line, i) => (
                                        <p key={i} style={{ margin: '4px 0' }}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                    {isLoading && (
                        <div style={{ ...styles.chatMessage, ...styles.assistantMessage }}>
                            <div style={styles.messageRole}>AI</div>
                            <div style={styles.typingIndicator}>
                                <span>.</span><span>.</span><span>.</span>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div style={styles.chatInput}>
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask about your business..."
                        disabled={isLoading}
                        style={styles.textarea}
                        rows={2}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={isLoading || !inputValue.trim()}
                        style={styles.sendButton}
                    >
                        {isLoading ? '...' : 'Send'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Helper function
function getPriorityColor(priority: string): string {
    switch (priority) {
        case 'high': return '#ef4444'
        case 'medium': return '#f59e0b'
        case 'low': return '#22c55e'
        default: return '#6b7280'
    }
}

// Styles
const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px',
    },
    title: {
        fontSize: '28px',
        fontWeight: 700,
        margin: 0,
        color: '#111827',
    },
    subtitle: {
        fontSize: '14px',
        color: '#6b7280',
        margin: '4px 0 0 0',
    },
    headerActions: {
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
    },
    modelSelect: {
        padding: '8px 12px',
        borderRadius: '6px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        backgroundColor: 'white',
        cursor: 'pointer',
    },
    refreshButton: {
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: '#10b981',
        color: 'white',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
    },
    errorBanner: {
        padding: '12px 16px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        color: '#dc2626',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    errorDismiss: {
        background: 'none',
        border: 'none',
        color: '#dc2626',
        cursor: 'pointer',
        fontSize: '16px',
    },
    insightsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
    },
    insightCard: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderLeft: '4px solid',
    },
    insightCardSkeleton: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    skeletonTitle: {
        height: '20px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        marginBottom: '12px',
        width: '60%',
        animation: 'pulse 1.5s infinite',
    },
    skeletonText: {
        height: '14px',
        backgroundColor: '#e5e7eb',
        borderRadius: '4px',
        marginBottom: '8px',
        animation: 'pulse 1.5s infinite',
    },
    insightHeader: {
        display: 'flex',
        gap: '8px',
        marginBottom: '12px',
    },
    priorityBadge: {
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'white',
        textTransform: 'uppercase',
    },
    categoryBadge: {
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 500,
        backgroundColor: '#f3f4f6',
        color: '#6b7280',
    },
    insightTitle: {
        fontSize: '16px',
        fontWeight: 600,
        margin: '0 0 8px 0',
        color: '#111827',
    },
    metricDisplay: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        marginBottom: '8px',
    },
    metricValue: {
        fontSize: '24px',
        fontWeight: 700,
        color: '#111827',
    },
    changeIndicator: {
        fontSize: '14px',
        fontWeight: 600,
    },
    insightSummary: {
        fontSize: '14px',
        color: '#4b5563',
        margin: '0 0 12px 0',
        lineHeight: 1.5,
    },
    recommendations: {
        margin: 0,
        paddingLeft: '20px',
    },
    recommendation: {
        fontSize: '13px',
        color: '#6b7280',
        marginBottom: '4px',
    },
    quickPromptsSection: {
        marginBottom: '24px',
    },
    quickPromptsLabel: {
        fontSize: '14px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '8px',
        display: 'block',
    },
    quickPromptsRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
    },
    quickPromptButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '20px',
        border: '1px solid #e5e7eb',
        backgroundColor: 'white',
        fontSize: '13px',
        fontWeight: 500,
        color: '#374151',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    quickPromptIcon: {
        width: '18px',
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: '50%',
        fontSize: '10px',
        fontWeight: 700,
    },
    chatSection: {
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden',
    },
    chatHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
    },
    chatTitle: {
        fontSize: '16px',
        fontWeight: 600,
        margin: 0,
        color: '#111827',
    },
    clearChatButton: {
        padding: '4px 10px',
        borderRadius: '4px',
        border: '1px solid #e5e7eb',
        backgroundColor: 'white',
        fontSize: '12px',
        color: '#6b7280',
        cursor: 'pointer',
    },
    chatMessages: {
        height: '400px',
        overflowY: 'auto',
        padding: '20px',
    },
    emptyChat: {
        textAlign: 'center',
        color: '#9ca3af',
        padding: '40px 20px',
        fontSize: '14px',
    },
    chatMessage: {
        marginBottom: '16px',
        maxWidth: '85%',
    },
    userMessage: {
        marginLeft: 'auto',
    },
    assistantMessage: {
        marginRight: 'auto',
    },
    messageRole: {
        fontSize: '11px',
        fontWeight: 600,
        color: '#6b7280',
        marginBottom: '4px',
        textTransform: 'uppercase',
    },
    messageContent: {
        padding: '12px 16px',
        borderRadius: '12px',
        fontSize: '14px',
        lineHeight: 1.6,
        backgroundColor: '#f3f4f6',
        color: '#111827',
    },
    typingIndicator: {
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        gap: '4px',
    },
    chatInput: {
        display: 'flex',
        gap: '12px',
        padding: '16px 20px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#fafafa',
    },
    textarea: {
        flex: 1,
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #d1d5db',
        fontSize: '14px',
        resize: 'none',
        fontFamily: 'inherit',
    },
    sendButton: {
        padding: '12px 24px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: '#3b82f6',
        color: 'white',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        alignSelf: 'flex-end',
    },
}

export default AIBusinessAssistant
