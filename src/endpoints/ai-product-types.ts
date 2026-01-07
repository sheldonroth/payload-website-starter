/**
 * Shared types for AI-extracted product data
 * Used by channel-analyze, video-analyze, and tiktok-analyze endpoints
 */

import type { Product } from '@/payload-types'
import type { RequiredDataFromCollectionSlug } from 'payload'

/**
 * Data structure for creating AI-extracted products
 * This is a partial Product type with only the fields needed for AI extraction
 */
export interface AIExtractedProductData {
    name: string
    brand: string
    status: 'ai_draft'
    priceRange?: '$' | '$$' | '$$$' | '$$$$'
    summary?: string
    verdict: 'recommend' | 'caution' | 'avoid'
    verdictReason?: string
    sourceUrl?: string
    sourceVideo?: number
    sourceCount?: number
    category?: number
    pendingCategoryName?: string
    aiConfidence?: 'high' | 'medium' | 'low'
    aiSourceType?: 'transcript' | 'video_watching' | 'profile' | 'manual' | 'crowdsource'
    aiMentions?: number
}

/**
 * Type for required product fields - Payload expects these when creating
 */
type RequiredProductFields = Pick<Product, 'name' | 'brand' | 'verdict'>

/**
 * Type for optional product fields that can be included when creating
 */
type OptionalProductFields = Partial<Pick<Product,
    | 'status'
    | 'priceRange'
    | 'summary'
    | 'verdictReason'
    | 'sourceUrl'
    | 'sourceVideo'
    | 'sourceCount'
    | 'category'
    | 'pendingCategoryName'
    | 'aiConfidence'
    | 'aiSourceType'
    | 'aiMentions'
>>

/**
 * Combined type for product creation data
 */
export type ProductCreateData = RequiredProductFields & OptionalProductFields

/**
 * Create type-safe product data for Payload create operation
 * Returns data typed for use with Payload's create function
 */
export function createProductData(data: AIExtractedProductData): ProductCreateData {
    const productData: ProductCreateData = {
        name: data.name,
        brand: data.brand,
        verdict: data.verdict,
    }

    // Add optional fields only if they are defined
    if (data.status) productData.status = data.status
    if (data.priceRange) productData.priceRange = data.priceRange
    if (data.summary) productData.summary = data.summary
    if (data.verdictReason) productData.verdictReason = data.verdictReason
    if (data.sourceUrl) productData.sourceUrl = data.sourceUrl
    if (data.sourceVideo !== undefined) productData.sourceVideo = data.sourceVideo
    if (data.sourceCount !== undefined) productData.sourceCount = data.sourceCount
    if (data.category !== undefined) productData.category = data.category
    if (data.pendingCategoryName) productData.pendingCategoryName = data.pendingCategoryName
    if (data.aiConfidence) productData.aiConfidence = data.aiConfidence
    if (data.aiSourceType) productData.aiSourceType = data.aiSourceType
    if (data.aiMentions !== undefined) productData.aiMentions = data.aiMentions

    return productData
}
