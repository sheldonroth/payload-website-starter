/**
 * Fuzzy matching utilities for duplicate detection
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length
    const n = str2.length

    // Create a 2D array
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    // Initialize first column
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i
    }

    // Initialize first row
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j
    }

    // Fill the rest
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1]
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                )
            }
        }
    }

    return dp[m][n]
}

/**
 * Calculate similarity score between two strings (0-1, 1 = identical)
 */
export function stringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()

    if (s1 === s2) return 1
    if (s1.length === 0 || s2.length === 0) return 0

    const distance = levenshteinDistance(s1, s2)
    const maxLength = Math.max(s1.length, s2.length)

    return 1 - distance / maxLength
}

/**
 * Normalize product name for comparison
 * - Lowercase
 * - Remove common words (the, a, an)
 * - Remove special characters
 * - Normalize whitespace
 */
export function normalizeProductName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars
        .replace(/\b(the|a|an|and|or|of|for|with)\b/g, '') // Remove common words
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Normalize brand name for comparison
 */
export function normalizeBrandName(brand: string): string {
    return brand
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\b(inc|llc|ltd|co|corp|corporation|company)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Check if two products are likely duplicates
 * Returns a score from 0-1 (1 = definitely duplicate)
 */
export function calculateDuplicateScore(
    product1: { name: string; brand?: string; upc?: string },
    product2: { name: string; brand?: string; upc?: string }
): number {
    // Exact UPC match = definite duplicate
    if (product1.upc && product2.upc && product1.upc === product2.upc) {
        return 1.0
    }

    const name1 = normalizeProductName(product1.name)
    const name2 = normalizeProductName(product2.name)

    // Exact name match
    if (name1 === name2) {
        // If brands also match or both empty, very likely duplicate
        if (!product1.brand || !product2.brand) return 0.9

        const brand1 = normalizeBrandName(product1.brand)
        const brand2 = normalizeBrandName(product2.brand)

        if (brand1 === brand2) return 0.95
        if (stringSimilarity(brand1, brand2) > 0.8) return 0.85

        return 0.7 // Same name, different brand
    }

    // Fuzzy name match
    const nameSimilarity = stringSimilarity(name1, name2)

    if (nameSimilarity < 0.6) {
        return 0 // Too different
    }

    // Check brand similarity
    let brandScore = 0.5 // Neutral if no brands
    if (product1.brand && product2.brand) {
        const brand1 = normalizeBrandName(product1.brand)
        const brand2 = normalizeBrandName(product2.brand)
        brandScore = stringSimilarity(brand1, brand2)
    }

    // Weighted combination: 60% name, 40% brand
    const combinedScore = (nameSimilarity * 0.6) + (brandScore * 0.4)

    return combinedScore
}

/**
 * Find potential duplicates in the database
 */
export interface DuplicateMatch {
    id: number
    name: string
    brand?: string
    status: string
    score: number
}

export async function findPotentialDuplicates(
    product: { name: string; brand?: string; upc?: string },
    payload: any,
    options: {
        threshold?: number
        limit?: number
        excludeStatus?: string[]
    } = {}
): Promise<DuplicateMatch[]> {
    const { threshold = 0.7, limit = 5, excludeStatus = [] } = options

    // Quick UPC check first
    if (product.upc) {
        const upcMatch = await payload.find({
            collection: 'products',
            where: { upc: { equals: product.upc } },
            limit: 1,
        })

        if (upcMatch.docs.length > 0) {
            const match = upcMatch.docs[0]
            return [{
                id: match.id as number,
                name: match.name as string,
                brand: match.brand as string | undefined,
                status: match.status as string,
                score: 1.0,
            }]
        }
    }

    // Fuzzy search - get products with similar starting letters
    const normalizedName = normalizeProductName(product.name)
    const searchTerms = normalizedName.split(' ').filter(word => word.length > 2)

    if (searchTerms.length === 0) {
        return []
    }

    // Search for products containing any of the key words
    const candidates = await payload.find({
        collection: 'products',
        where: {
            or: searchTerms.slice(0, 3).map(term => ({
                name: { contains: term },
            })),
        },
        limit: 50, // Get more candidates for fuzzy matching
    })

    // Calculate duplicate scores
    const matches: DuplicateMatch[] = []

    for (const candidate of candidates.docs) {
        // Skip if excluded status
        if (excludeStatus.includes(candidate.status as string)) continue

        const score = calculateDuplicateScore(product, {
            name: candidate.name as string,
            brand: candidate.brand as string | undefined,
            upc: candidate.upc as string | undefined,
        })

        if (score >= threshold) {
            matches.push({
                id: candidate.id as number,
                name: candidate.name as string,
                brand: candidate.brand as string | undefined,
                status: candidate.status as string,
                score,
            })
        }
    }

    // Sort by score descending and return top matches
    return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
}
