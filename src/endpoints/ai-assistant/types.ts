/**
 * AI Business Assistant - TypeScript Types
 */

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    timestamp: string
}

export interface AIAssistantRequest {
    action: 'analyze' | 'chat'
    prompt?: string
    analysisType?: 'revenue' | 'churn' | 'experiments' | 'referrals' | 'email' | 'full'
    conversationHistory?: ChatMessage[]
    model?: 'gemini-2.0-flash' | 'gemini-3-flash-preview' | 'gemini-3-pro-preview'
}

export interface Insight {
    title: string
    summary: string
    recommendations: string[]
    priority: 'high' | 'medium' | 'low'
    category: 'revenue' | 'churn' | 'experiments' | 'referrals' | 'email' | 'product'
    metric?: string
    change?: number
}

export interface AIAssistantResponse {
    success: boolean
    message: string
    insights?: Insight[]
    tokenUsage?: number
    cached?: boolean
    model?: string
    error?: string
}

export interface BusinessContext {
    revenue: {
        daily: number | null
        weekly: number | null
        dailyChange: number | null
        weeklyChange: number | null
        mrr: number | null
        activeSubscribers: number | null
    } | null
    trials: {
        started: number
        active: number
        converted: number
        conversionRate: number
    } | null
    churn: {
        overall: number
        byCohort: { month: string; totalUsers: number; churned: number; churnRate: number }[]
    } | null
    experiments: {
        name: string
        status: string
        variants: { name: string; conversionRate: number; isWinning: boolean; sampleSize: number }[]
    }[]
    referrals: {
        total: number
        active: number
        bySource: { source: string; count: number; conversionRate: number }[]
        topReferrers: { code: string; totalReferrals: number; commission: number }[]
        commissionPending: number
        commissionPaid: number
    } | null
    predictions: {
        currentMRR: number
        predicted30Day: number
        predicted90Day: number
        confidence: number
        trend: 'up' | 'down' | 'stable'
        growthRate: number
    } | null
    productCatalog: {
        totalProducts: number
        publishedProducts: number
        draftProducts: number
        aiDrafts: number
        recentUnlocks: number
        recentVotes: number
    }
    emailMetrics: {
        totalSent: number
        averageOpenRate: number
        averageClickRate: number
        recentCampaigns: number
    }
}
