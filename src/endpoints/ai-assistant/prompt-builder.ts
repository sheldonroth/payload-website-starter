/**
 * AI Business Assistant - Prompt Builder
 *
 * Constructs system prompts and templates for AI analysis
 */

import type { BusinessContext } from './types'

/**
 * Build the system prompt with business context
 */
export function buildSystemPrompt(context: BusinessContext): string {
    return `You are a senior business intelligence analyst for "The Product Report," a subscription-based mobile app that provides independent product reviews and safety testing.

## YOUR ROLE
- Analyze business metrics with precision and provide actionable insights
- Identify growth opportunities, risks, and optimization strategies
- Support recommendations with specific data from the context provided
- Think like a growth advisor who understands subscription businesses

## BUSINESS MODEL CONTEXT
- Revenue: Monthly subscriptions via RevenueCat
- Free users get limited product unlocks, premium gets unlimited
- Referral program: $25/year commission per referred subscriber
- Content: AI-generated product reviews, verified by editors
- Engagement: Daily discoveries, product votes, barcode scanning

## RESPONSE GUIDELINES
1. Be concise but thorough - executives are busy
2. Always cite specific numbers from the data (e.g., "Your 8.2% trial conversion...")
3. Prioritize insights by potential revenue impact
4. Suggest specific A/B tests or experiments when relevant
5. Consider mobile app-specific growth strategies (push notifications, deep links, etc.)
6. Use bullet points for recommendations

## IMPORTANT CONSTRAINTS
- Only reference data that is provided - never hallucinate metrics
- If data is missing or insufficient, explicitly say so
- For financial projections, always note confidence levels
- Keep responses focused and actionable

## CURRENT BUSINESS DATA
<BUSINESS_CONTEXT>
${JSON.stringify(context, null, 2)}
</BUSINESS_CONTEXT>

Analyze the data and provide strategic insights. Be specific and actionable.`
}

/**
 * Pre-built prompt templates for quick analysis
 */
export const PROMPT_TEMPLATES = {
    revenue: `Analyze our revenue metrics in detail:
- Current MRR and growth trajectory
- Daily/weekly revenue trends
- Active subscriber count and changes
- Provide 3-5 specific, actionable strategies to grow MRR
Consider our trial conversion rate, churn patterns, and referral program effectiveness.`,

    churn: `Deep dive into our churn metrics:
- Overall churn rate analysis
- Cohort-by-cohort breakdown - which signup months have highest retention?
- What patterns do you see in the churn data?
- Provide specific recommendations to reduce churn
- Suggest any A/B tests to improve retention`,

    experiments: `Review our A/B testing program:
- Which experiments are running and their current results?
- Which variants are winning? With what confidence?
- Which experiments should we ship immediately?
- Which need more data before deciding?
- Suggest 2-3 new experiments we should run based on our metrics`,

    referrals: `Analyze our referral program performance:
- Total referrals and active conversion rates
- Which referral sources (mobile, web, direct link) perform best?
- Who are our top referrers and what can we learn from them?
- Commission tracking - are we profitable on referrals?
- Specific recommendations to improve referral conversions`,

    email: `Review our email marketing performance:
- Average open rates and click rates
- Recent campaign performance
- Any A/B test results from subject lines or content?
- What patterns work best?
- Recommendations for improving email engagement`,

    full: `Provide a comprehensive business health check:

1. **Revenue Health**: MRR status, growth rate, and trajectory
2. **User Acquisition**: Trial starts, conversion rates, funnel efficiency
3. **Retention**: Churn analysis by cohort, red flags
4. **Growth Levers**: Referrals, experiments, opportunities
5. **Product Engagement**: Unlocks, votes, content performance

Then summarize:
- TOP 3 OPPORTUNITIES (highest potential impact)
- TOP 3 RISKS (need immediate attention)
- RECOMMENDED NEXT ACTIONS (prioritized)`,
}

/**
 * Build conversation context for chat
 */
export function buildConversationContext(
    systemPrompt: string,
    conversationHistory: { role: string; content: string; timestamp: string }[],
    newMessage: string
): { role: string; parts: { text: string }[] }[] {
    const messages: { role: string; parts: { text: string }[] }[] = [
        {
            role: 'user',
            parts: [{ text: systemPrompt }],
        },
        {
            role: 'model',
            parts: [{ text: 'I understand. I\'m ready to analyze your business data and provide strategic insights. What would you like me to focus on?' }],
        },
    ]

    // Add conversation history
    for (const msg of conversationHistory.slice(-10)) { // Keep last 10 messages for context
        messages.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
        })
    }

    // Add new message
    messages.push({
        role: 'user',
        parts: [{ text: newMessage }],
    })

    return messages
}

/**
 * Build analysis prompt for auto-generated insights
 */
export function buildInsightGenerationPrompt(): string {
    return `Based on the business data provided, generate a JSON array of 3-4 key insights. Each insight should be actionable and prioritized by business impact.

Return ONLY valid JSON in this exact format:
{
  "insights": [
    {
      "title": "Short insight title (max 50 chars)",
      "summary": "2-3 sentence explanation with specific numbers",
      "recommendations": ["Action item 1", "Action item 2"],
      "priority": "high|medium|low",
      "category": "revenue|churn|experiments|referrals|email|product",
      "metric": "Key metric value (e.g., '$4,523 MRR')",
      "change": 12.5
    }
  ]
}

Focus on the most impactful findings. Be specific with numbers.`
}
