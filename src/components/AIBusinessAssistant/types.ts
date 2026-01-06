/**
 * AI Business Assistant - Frontend Types
 */

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: string
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

export interface AIResponse {
    success: boolean
    message: string
    insights?: Insight[]
    model?: string
    error?: string
}

export type AnalysisType = 'revenue' | 'churn' | 'experiments' | 'referrals' | 'email' | 'full'

export type ModelType = 'gemini-2.0-flash' | 'gemini-3-flash-preview' | 'gemini-3-pro-preview'

export const MODEL_OPTIONS: { value: ModelType; label: string }[] = [
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Most Intelligent)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Stable)' },
]

export const QUICK_PROMPTS: { label: string; type: AnalysisType; icon: string }[] = [
    { label: 'Revenue Growth', type: 'revenue', icon: '$' },
    { label: 'Reduce Churn', type: 'churn', icon: '-' },
    { label: 'A/B Tests', type: 'experiments', icon: 'A' },
    { label: 'Referrals', type: 'referrals', icon: '*' },
    { label: 'Email Tips', type: 'email', icon: '@' },
    { label: 'Full Check', type: 'full', icon: '#' },
]
