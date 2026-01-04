import type { Payload } from 'payload'
import { getThresholds } from './get-thresholds'
import { createAuditLog } from '../collections/AuditLog'
import { logError } from './error-logger'

/**
 * AI Category Classification Utility
 *
 * Uses Gemini AI to suggest categories for new products based on:
 * - Product name
 * - Brand name
 * - Ingredients list
 *
 * Returns category suggestions with confidence scores.
 */

interface CategorySuggestion {
    categoryId: number | null
    categoryName: string
    confidence: number
    reasoning: string
}

interface ClassificationResult {
    suggestion: CategorySuggestion | null
    autoAssigned: boolean
    message: string
}

/**
 * Get list of available categories from database
 */
async function getAvailableCategories(payload: Payload): Promise<Array<{ id: number; name: string; parent?: string }>> {
    const categories = await payload.find({
        collection: 'categories',
        limit: 200,
        depth: 1,
    })

    return categories.docs.map(cat => {
        const catData = cat as {
            id: number
            name: string
            parent?: { name: string } | number
        }

        let parentName: string | undefined
        if (catData.parent && typeof catData.parent === 'object') {
            parentName = catData.parent.name
        }

        return {
            id: catData.id,
            name: catData.name,
            parent: parentName,
        }
    })
}

/**
 * Classify a product into a category using AI
 */
export async function classifyCategory(
    payload: Payload,
    productData: {
        name: string
        brand?: string
        ingredientsRaw?: string
    }
): Promise<ClassificationResult> {
    const result: ClassificationResult = {
        suggestion: null,
        autoAssigned: false,
        message: '',
    }

    // Check if AI categories are enabled
    const thresholds = await getThresholds(payload)
    if (!thresholds.enableAICategories) {
        result.message = 'AI category classification is disabled'
        return result
    }

    // Check for API key
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
        result.message = 'Gemini API key not configured'
        return result
    }

    try {
        // Get available categories
        const categories = await getAvailableCategories(payload)

        if (categories.length === 0) {
            result.message = 'No categories available for classification'
            return result
        }

        // Build category list for prompt
        const categoryList = categories.map(c =>
            c.parent ? `${c.parent} > ${c.name}` : c.name
        ).join('\n')

        // Build product description
        const productDesc = [
            `Product Name: ${productData.name}`,
            productData.brand ? `Brand: ${productData.brand}` : '',
            productData.ingredientsRaw ? `Ingredients: ${productData.ingredientsRaw.substring(0, 500)}` : '',
        ].filter(Boolean).join('\n')

        // Call Gemini AI
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are a product categorization expert. Analyze the following product and suggest the most appropriate category from the available options.

PRODUCT:
${productDesc}

AVAILABLE CATEGORIES:
${categoryList}

Respond with ONLY valid JSON in this exact format:
{
  "categoryName": "The exact category name from the list above",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category fits"
}

If no category fits well, use confidence below 0.5.
The category name MUST exactly match one from the list.`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 200,
                    },
                }),
            }
        )

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!text) {
            throw new Error('Empty response from Gemini')
        }

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('No JSON found in response')
        }

        const aiResult = JSON.parse(jsonMatch[0]) as {
            categoryName: string
            confidence: number
            reasoning: string
        }

        // Find matching category ID
        const matchedCategory = categories.find(c =>
            c.name.toLowerCase() === aiResult.categoryName.toLowerCase() ||
            (c.parent && `${c.parent} > ${c.name}`.toLowerCase() === aiResult.categoryName.toLowerCase())
        )

        if (!matchedCategory) {
            result.message = `AI suggested "${aiResult.categoryName}" but no matching category found`
            return result
        }

        result.suggestion = {
            categoryId: matchedCategory.id,
            categoryName: matchedCategory.parent
                ? `${matchedCategory.parent} > ${matchedCategory.name}`
                : matchedCategory.name,
            confidence: Math.round(aiResult.confidence * 100),
            reasoning: aiResult.reasoning,
        }

        // Auto-assign if confidence meets threshold
        const confidencePercent = aiResult.confidence * 100
        if (confidencePercent >= thresholds.aiCategoryConfidence) {
            result.autoAssigned = true
            result.message = `Auto-assigned to "${result.suggestion.categoryName}" (${result.suggestion.confidence}% confidence)`
        } else {
            result.message = `Suggested "${result.suggestion.categoryName}" (${result.suggestion.confidence}% confidence) - below auto-assign threshold`
        }

        // Log to audit
        await createAuditLog(payload, {
            action: 'ai_verdict_set',
            sourceType: 'system',
            targetCollection: 'categories',
            targetId: matchedCategory.id,
            targetName: result.suggestion.categoryName,
            aiModel: 'gemini-2.0-flash',
            confidence: result.suggestion.confidence,
            metadata: {
                productName: productData.name,
                reasoning: aiResult.reasoning,
                autoAssigned: result.autoAssigned,
                threshold: thresholds.aiCategoryConfidence,
            },
        })

        return result
    } catch (error) {
        await logError(payload, {
            category: 'ai_classification_error',
            message: `Failed to classify category for "${productData.name}"`,
            targetCollection: 'products',
            error,
        })

        result.message = 'AI classification failed'
        return result
    }
}

/**
 * Suggest category for a product (non-blocking, for UI hints)
 * Returns null if classification not possible
 */
export async function suggestCategoryForProduct(
    payload: Payload,
    productId: number
): Promise<CategorySuggestion | null> {
    try {
        const product = await payload.findByID({
            collection: 'products',
            id: productId,
        })

        if (!product) return null

        const productData = product as {
            name: string
            brand?: string
            ingredientsRaw?: string
        }

        const result = await classifyCategory(payload, {
            name: productData.name,
            brand: productData.brand,
            ingredientsRaw: productData.ingredientsRaw,
        })

        return result.suggestion
    } catch {
        return null
    }
}
