/**
 * Liability Shield
 *
 * Strips sensitive data from AVOID products for non-premium users.
 * This protects The Product Report from liability while still
 * providing value to free users (they know to avoid the product).
 *
 * Premium users get full access to all product details.
 */

interface Product {
    id: number
    name: string
    brand?: string
    verdict?: 'recommend' | 'avoid'
    verdictReason?: string
    imageUrl?: string | null
    backgroundRemovedImageUrl?: string | null
    category?: { id: number; name: string } | number
    ingredientsList?: unknown[]
    ingredientsRaw?: string | null
    pros?: unknown[] | null
    cons?: unknown[] | null
    fullReview?: string | null
    purchaseLinks?: unknown[] | null
    testingInfo?: string | null
    summary?: string | null
    sourceCount?: number
    [key: string]: unknown
}

interface ShieldedProduct extends Omit<Product, 'ingredientsList' | 'ingredientsRaw' | 'pros' | 'cons' | 'fullReview' | 'purchaseLinks' | 'testingInfo'> {
    ingredientsList: never[]
    ingredientsRaw: null
    pros: null
    cons: null
    fullReview: null
    purchaseLinks: null
    testingInfo: null
    verdictReason: string
    isShielded: true
}

/**
 * Fields that are stripped from AVOID products for non-premium users.
 * These are the sensitive/liability-prone fields.
 */
export const SHIELDED_FIELDS = [
    'ingredientsList',
    'ingredientsRaw',
    'pros',
    'cons',
    'fullReview',
    'purchaseLinks',
    'testingInfo',
    'summary',
] as const

/**
 * Fields that are always visible, even for AVOID products.
 * These help users identify the product without detailed analysis.
 */
export const PUBLIC_FIELDS = [
    'id',
    'name',
    'brand',
    'verdict',
    'imageUrl',
    'backgroundRemovedImageUrl',
    'category',
    'slug',
    'priceRange',
    'status',
] as const

/**
 * Apply liability shield to a product.
 *
 * If the product is AVOID and the user is not premium,
 * strip sensitive fields and replace verdictReason with generic text.
 *
 * @param product - The product to shield
 * @param isPremium - Whether the user has premium access
 * @returns The product with shielded fields if applicable
 */
export function applyLiabilityShield<T extends Product>(
    product: T,
    isPremium: boolean
): T | (T & ShieldedProduct) {
    // Only shield AVOID products for non-premium users
    if (product.verdict !== 'avoid' || isPremium) {
        return product
    }

    // Create shielded version
    return {
        ...product,
        // Strip sensitive fields
        ingredientsList: [],
        ingredientsRaw: null,
        pros: null,
        cons: null,
        fullReview: null,
        purchaseLinks: null,
        testingInfo: null,
        summary: null,
        // Replace specific reason with generic
        verdictReason: 'Does Not Meet Our Standards',
        // Mark as shielded
        isShielded: true,
    } as T & ShieldedProduct
}

/**
 * Apply liability shield to an array of products.
 *
 * @param products - Array of products to shield
 * @param isPremium - Whether the user has premium access
 * @returns Array of products with shielded fields where applicable
 */
export function applyLiabilityShieldToMany<T extends Product>(
    products: T[],
    isPremium: boolean
): (T | (T & ShieldedProduct))[] {
    return products.map((product) => applyLiabilityShield(product, isPremium))
}

/**
 * Check if a user has premium access.
 *
 * @param user - The user object from Payload
 * @returns Whether the user has premium access
 */
export function isPremiumUser(user: {
    memberState?: string
    subscriptionStatus?: string
    role?: string
} | null | undefined): boolean {
    if (!user) return false

    // Admins always have premium access
    if (user.role === 'admin') return true

    // Premium members have access
    if (user.memberState === 'member') return true

    // Users with active subscription have access
    if (user.subscriptionStatus === 'premium') return true

    return false
}

/**
 * Middleware helper to apply liability shield in API responses.
 *
 * @param products - Products from the API
 * @param user - Current user (or null for guests)
 * @returns Products with liability shield applied
 */
export function shieldProductsForUser<T extends Product>(
    products: T[],
    user: { memberState?: string; subscriptionStatus?: string; role?: string } | null | undefined
): (T | (T & ShieldedProduct))[] {
    const isPremium = isPremiumUser(user)
    return applyLiabilityShieldToMany(products, isPremium)
}

/**
 * Check if a product is shielded (for frontend display logic).
 *
 * @param product - The product to check
 * @returns Whether the product has been shielded
 */
export function isProductShielded(product: { isShielded?: boolean }): boolean {
    return product.isShielded === true
}
