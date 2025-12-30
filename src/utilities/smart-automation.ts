import type { Payload } from 'payload'

/**
 * Smart Automation Utilities
 *
 * Core functions for:
 * - Auto-parsing ingredients from raw text
 * - Evaluating VerdictRules
 * - Detecting conflicts
 * - Creating/linking categories hierarchically
 */

// ============================================
// INGREDIENT PARSING
// ============================================

interface ParsedIngredient {
    name: string
    matched: boolean
    ingredientId?: number
    verdict?: string
    aliases?: string[]
}

interface ParseResult {
    linkedIds: number[]
    unmatched: string[]
    autoVerdict: 'recommend' | 'caution' | 'avoid' | null
    parsedIngredients: ParsedIngredient[]
}

/**
 * Parse raw ingredients text and match to existing ingredients
 */
export async function parseAndLinkIngredients(
    rawText: string,
    payload: Payload
): Promise<ParseResult> {
    const result: ParseResult = {
        linkedIds: [],
        unmatched: [],
        autoVerdict: null,
        parsedIngredients: [],
    }

    if (!rawText?.trim()) {
        return result
    }

    // Split by common delimiters
    const rawNames = rawText
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 1)

    // Fetch all ingredients with aliases for matching
    const allIngredients = await payload.find({
        collection: 'ingredients',
        limit: 1000,
    })

    const ingredientMap = new Map<string, { id: number; verdict: string; name: string }>()

    // Build lookup map with name and aliases
    for (const ing of allIngredients.docs) {
        const ingData = ing as {
            id: number
            name: string
            verdict: string
            aliases?: Array<{ alias: string }>
        }

        // Add main name
        ingredientMap.set(ingData.name.toLowerCase(), {
            id: ingData.id,
            verdict: ingData.verdict,
            name: ingData.name,
        })

        // Add aliases
        if (ingData.aliases?.length) {
            for (const alias of ingData.aliases) {
                if (alias.alias) {
                    ingredientMap.set(alias.alias.toLowerCase(), {
                        id: ingData.id,
                        verdict: ingData.verdict,
                        name: ingData.name,
                    })
                }
            }
        }
    }

    // Match each raw ingredient
    let worstVerdict: 'recommend' | 'caution' | 'avoid' = 'recommend'

    for (const rawName of rawNames) {
        const normalized = rawName.toLowerCase().trim()
            // Remove common suffixes like percentages, parenthetical notes
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\s*\d+%?$/g, '')
            .trim()

        // Try exact match
        let match = ingredientMap.get(normalized)

        // Try partial match if no exact
        if (!match) {
            for (const [key, value] of ingredientMap) {
                if (normalized.includes(key) || key.includes(normalized)) {
                    match = value
                    break
                }
            }
        }

        if (match) {
            result.linkedIds.push(match.id)
            result.parsedIngredients.push({
                name: rawName,
                matched: true,
                ingredientId: match.id,
                verdict: match.verdict,
            })

            // Track worst verdict
            if (match.verdict === 'avoid') {
                worstVerdict = 'avoid'
            } else if (match.verdict === 'caution' && worstVerdict !== 'avoid') {
                worstVerdict = 'caution'
            }
        } else {
            result.unmatched.push(rawName)
            result.parsedIngredients.push({
                name: rawName,
                matched: false,
            })
        }
    }

    // Remove duplicates from linkedIds
    result.linkedIds = [...new Set(result.linkedIds)]

    // Set auto verdict if we matched any ingredients
    if (result.linkedIds.length > 0) {
        result.autoVerdict = worstVerdict
    }

    return result
}

/**
 * Create missing ingredients as "unknown" verdict
 */
export async function createMissingIngredients(
    unmatchedNames: string[],
    payload: Payload,
    sourceVideoId?: number
): Promise<number[]> {
    const createdIds: number[] = []

    for (const name of unmatchedNames) {
        try {
            const created = await payload.create({
                collection: 'ingredients',
                data: {
                    name: name.trim(),
                    verdict: 'unknown',
                    reason: 'Auto-created from product ingredients - needs research',
                    autoFlagProducts: false, // Don't cascade until researched
                    ...(sourceVideoId ? { sourceVideo: sourceVideoId } : {}),
                },
            })
            createdIds.push(created.id as number)
        } catch (error) {
            // Might fail if duplicate - ignore
            console.log(`Could not create ingredient "${name}":`, error)
        }
    }

    return createdIds
}

// ============================================
// VERDICT RULES ENGINE
// ============================================

interface VerdictRule {
    id: number
    name: string
    conditionType: 'contains_ingredient' | 'missing_ingredient' | 'ingredient_verdict' | 'category_match'
    ingredientCondition?: number[]
    ingredientVerdictCondition?: 'avoid' | 'caution' | 'safe_only'
    categoryCondition?: number[]
    action: 'set_avoid' | 'set_caution' | 'set_recommend' | 'block_publish' | 'warn_only'
    warningMessage?: string
    isActive: boolean
    priority: number
}

interface RuleEvaluation {
    ruleId: number
    ruleName: string
    matched: boolean
    action: VerdictRule['action']
    message?: string
}

/**
 * Evaluate all active VerdictRules against a product
 */
export async function evaluateVerdictRules(
    productData: {
        ingredientsList?: number[]
        category?: number
        verdict?: string
    },
    payload: Payload
): Promise<{
    evaluations: RuleEvaluation[]
    suggestedVerdict?: 'recommend' | 'caution' | 'avoid'
    shouldBlock: boolean
    warnings: string[]
}> {
    const result = {
        evaluations: [] as RuleEvaluation[],
        suggestedVerdict: undefined as 'recommend' | 'caution' | 'avoid' | undefined,
        shouldBlock: false,
        warnings: [] as string[],
    }

    // Fetch active rules sorted by priority
    const rulesResult = await payload.find({
        collection: 'verdict-rules',
        where: { isActive: { equals: true } },
        sort: '-priority',
        limit: 100,
    })

    if (rulesResult.docs.length === 0) {
        return result
    }

    // Get ingredient verdicts if we have ingredients
    const ingredientVerdicts = new Map<number, string>()
    if (productData.ingredientsList?.length) {
        const ingredients = await payload.find({
            collection: 'ingredients',
            where: { id: { in: productData.ingredientsList } },
            limit: 100,
        })

        for (const ing of ingredients.docs) {
            const ingData = ing as { id: number; verdict: string }
            ingredientVerdicts.set(ingData.id, ingData.verdict)
        }
    }

    // Evaluate each rule
    for (const ruleDoc of rulesResult.docs) {
        const rule = ruleDoc as unknown as VerdictRule
        let matched = false

        switch (rule.conditionType) {
            case 'contains_ingredient':
                if (rule.ingredientCondition?.length && productData.ingredientsList?.length) {
                    matched = rule.ingredientCondition.some(id =>
                        productData.ingredientsList!.includes(id)
                    )
                }
                break

            case 'missing_ingredient':
                if (rule.ingredientCondition?.length) {
                    matched = !rule.ingredientCondition.some(id =>
                        productData.ingredientsList?.includes(id)
                    )
                }
                break

            case 'ingredient_verdict':
                if (rule.ingredientVerdictCondition && ingredientVerdicts.size > 0) {
                    const verdicts = Array.from(ingredientVerdicts.values())
                    switch (rule.ingredientVerdictCondition) {
                        case 'avoid':
                            matched = verdicts.includes('avoid')
                            break
                        case 'caution':
                            matched = verdicts.includes('caution')
                            break
                        case 'safe_only':
                            matched = verdicts.every(v => v === 'safe' || v === 'recommend')
                            break
                    }
                }
                break

            case 'category_match':
                if (rule.categoryCondition?.length && productData.category) {
                    matched = rule.categoryCondition.includes(productData.category)
                }
                break
        }

        result.evaluations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            matched,
            action: rule.action,
            message: matched ? rule.warningMessage : undefined,
        })

        if (matched) {
            // Apply action
            switch (rule.action) {
                case 'set_avoid':
                    result.suggestedVerdict = 'avoid'
                    break
                case 'set_caution':
                    if (result.suggestedVerdict !== 'avoid') {
                        result.suggestedVerdict = 'caution'
                    }
                    break
                case 'set_recommend':
                    if (!result.suggestedVerdict) {
                        result.suggestedVerdict = 'recommend'
                    }
                    break
                case 'block_publish':
                    result.shouldBlock = true
                    if (rule.warningMessage) {
                        result.warnings.push(rule.warningMessage)
                    }
                    break
                case 'warn_only':
                    if (rule.warningMessage) {
                        result.warnings.push(rule.warningMessage)
                    }
                    break
            }

            // Increment applied count on the rule
            try {
                await payload.update({
                    collection: 'verdict-rules',
                    id: rule.id,
                    data: { appliedCount: ((ruleDoc as { appliedCount?: number }).appliedCount || 0) + 1 },
                })
            } catch {
                // Non-critical, continue
            }
        }
    }

    return result
}

// ============================================
// CATEGORY HYDRATION
// ============================================

/**
 * Parse hierarchical category string and create categories if needed
 * Input: "Food & Beverage > Protein Bars"
 * Output: { parentId, childId }
 */
export async function hydrateCategory(
    categoryPath: string,
    payload: Payload,
    options: { aiSuggested?: boolean; sourceVideoId?: string } = {}
): Promise<{ categoryId: number; created: boolean; parentId?: number }> {
    const parts = categoryPath.split('>').map(s => s.trim()).filter(Boolean)

    if (parts.length === 0) {
        throw new Error('Invalid category path')
    }

    let parentId: number | undefined
    let lastCategoryId: number | undefined
    let created = false

    for (let i = 0; i < parts.length; i++) {
        const name = parts[i]
        const isChild = i > 0

        // Check if exists
        const existing = await payload.find({
            collection: 'categories',
            where: {
                and: [
                    { name: { equals: name } },
                    ...(isChild && parentId ? [{ parent: { equals: parentId } }] : []),
                ],
            },
            limit: 1,
        })

        if (existing.docs.length > 0) {
            const cat = existing.docs[0] as { id: number }
            if (isChild) {
                lastCategoryId = cat.id
            } else {
                parentId = cat.id
                lastCategoryId = cat.id
            }
        } else {
            // Create category
            const slug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')

            const newCat = await payload.create({
                collection: 'categories',
                data: {
                    name,
                    slug,
                    ...(isChild && parentId ? { parent: parentId } : {}),
                    aiSuggested: options.aiSuggested ?? true,
                    aiSource: options.sourceVideoId,
                },
            })

            created = true

            if (isChild) {
                lastCategoryId = newCat.id as number
            } else {
                parentId = newCat.id as number
                lastCategoryId = newCat.id as number
            }
        }
    }

    return {
        categoryId: lastCategoryId!,
        created,
        parentId: parts.length > 1 ? parentId : undefined,
    }
}

// ============================================
// CONFLICT DETECTION
// ============================================

export interface ConflictResult {
    hasConflicts: boolean
    conflicts: Array<{
        type: 'ingredient_verdict_mismatch' | 'rule_violation' | 'category_warning'
        severity: 'error' | 'warning'
        message: string
        details?: Record<string, unknown>
    }>
    canSave: boolean
}

/**
 * Detect conflicts between product verdict and its ingredients/rules
 */
export async function detectConflicts(
    productData: {
        verdict?: string
        ingredientsList?: number[]
        verdictOverride?: boolean
        category?: number
    },
    payload: Payload
): Promise<ConflictResult> {
    const result: ConflictResult = {
        hasConflicts: false,
        conflicts: [],
        canSave: true,
    }

    // Skip if no ingredients
    if (!productData.ingredientsList?.length) {
        return result
    }

    // Fetch ingredient verdicts
    const ingredients = await payload.find({
        collection: 'ingredients',
        where: { id: { in: productData.ingredientsList } },
        limit: 100,
    })

    const avoidIngredients: string[] = []
    const cautionIngredients: string[] = []

    for (const ing of ingredients.docs) {
        const ingData = ing as { name: string; verdict: string }
        if (ingData.verdict === 'avoid') {
            avoidIngredients.push(ingData.name)
        } else if (ingData.verdict === 'caution') {
            cautionIngredients.push(ingData.name)
        }
    }

    // Check for verdict mismatches
    if (productData.verdict === 'recommend') {
        if (avoidIngredients.length > 0) {
            result.hasConflicts = true
            result.conflicts.push({
                type: 'ingredient_verdict_mismatch',
                severity: 'error',
                message: `Cannot RECOMMEND product with AVOID ingredients: ${avoidIngredients.join(', ')}`,
                details: { avoidIngredients },
            })

            // Block save unless override is set
            if (!productData.verdictOverride) {
                result.canSave = false
            }
        }

        if (cautionIngredients.length > 0) {
            result.hasConflicts = true
            result.conflicts.push({
                type: 'ingredient_verdict_mismatch',
                severity: 'warning',
                message: `Product contains CAUTION ingredients: ${cautionIngredients.join(', ')}`,
                details: { cautionIngredients },
            })
        }
    }

    // Check category-specific warnings
    if (productData.category) {
        const category = await payload.findByID({
            collection: 'categories',
            id: productData.category,
        })

        if (category) {
            const catData = category as {
                harmfulIngredients?: Array<{ ingredient: string; reason?: string }>
            }

            if (catData.harmfulIngredients?.length) {
                for (const harmful of catData.harmfulIngredients) {
                    // Check if any product ingredient matches harmful ingredient name
                    for (const ing of ingredients.docs) {
                        const ingData = ing as { name: string }
                        if (ingData.name.toLowerCase().includes(harmful.ingredient.toLowerCase())) {
                            result.hasConflicts = true
                            result.conflicts.push({
                                type: 'category_warning',
                                severity: 'warning',
                                message: `Contains "${harmful.ingredient}" - ${harmful.reason || 'flagged as harmful for this category'}`,
                                details: { ingredient: harmful.ingredient, reason: harmful.reason },
                            })
                        }
                    }
                }
            }
        }
    }

    return result
}

// ============================================
// FRESHNESS MONITORING
// ============================================

export interface FreshnessStatus {
    status: 'fresh' | 'stale' | 'needs_review'
    daysSinceLastReview: number | null
    message: string
}

/**
 * Calculate content freshness for a product
 */
export function calculateFreshness(
    lastTestedDate: string | Date | null,
    thresholdDays: number = 180
): FreshnessStatus {
    if (!lastTestedDate) {
        return {
            status: 'needs_review',
            daysSinceLastReview: null,
            message: 'Never reviewed',
        }
    }

    const lastDate = new Date(lastTestedDate)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince > thresholdDays) {
        return {
            status: 'stale',
            daysSinceLastReview: daysSince,
            message: `Last reviewed ${daysSince} days ago`,
        }
    }

    if (daysSince > thresholdDays / 2) {
        return {
            status: 'needs_review',
            daysSinceLastReview: daysSince,
            message: `Review recommended (${daysSince} days since last review)`,
        }
    }

    return {
        status: 'fresh',
        daysSinceLastReview: daysSince,
        message: `Reviewed ${daysSince} days ago`,
    }
}
