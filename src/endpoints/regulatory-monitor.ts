import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { createAuditLog } from '../collections/AuditLog'

/**
 * Regulatory Monitor Endpoint
 * POST /api/regulatory/monitor
 *
 * Monitors regulatory sources for ingredient/product-related changes:
 * - FDA Federal Register
 * - California Prop 65 List
 * - EU EFSA Journal (abstracts)
 *
 * Can be triggered manually or via cron job.
 */

interface RegulatoryUpdate {
    source: string
    referenceId: string
    title: string
    summary?: string
    effectiveDate?: string
    url: string
    substances?: string[]
    changeType: string
}

interface MonitorResult {
    success: boolean
    source: string
    updatesFound: number
    newRecordsCreated: number
    updates: RegulatoryUpdate[]
    errors: string[]
}

/**
 * Fetch FDA Federal Register entries related to food safety
 */
async function fetchFDAFederalRegister(): Promise<RegulatoryUpdate[]> {
    const updates: RegulatoryUpdate[] = []

    try {
        // FDA Federal Register API
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0]

        const response = await fetch(
            `https://www.federalregister.gov/api/v1/documents.json?` +
            `conditions[agencies][]=food-and-drug-administration&` +
            `conditions[publication_date][gte]=${dateStr}&` +
            `conditions[type][]=Rule&conditions[type][]=Proposed+Rule&` +
            `per_page=50`,
            { headers: { 'User-Agent': 'ProductReportCMS/1.0' } }
        )

        if (!response.ok) {
            console.error('FDA Federal Register API error:', response.status)
            return []
        }

        const data = await response.json()

        for (const doc of data.results || []) {
            // Filter for food/ingredient related entries
            const title = (doc.title || '').toLowerCase()
            const abstract = (doc.abstract || '').toLowerCase()

            const isRelevant =
                title.includes('food') ||
                title.includes('ingredient') ||
                title.includes('additive') ||
                title.includes('color') ||
                title.includes('substance') ||
                abstract.includes('food safety') ||
                abstract.includes('dietary')

            if (isRelevant) {
                updates.push({
                    source: 'fda',
                    referenceId: doc.document_number || '',
                    title: doc.title || '',
                    summary: doc.abstract,
                    effectiveDate: doc.effective_on,
                    url: doc.html_url || `https://www.federalregister.gov/documents/${doc.document_number}`,
                    changeType: doc.type === 'Rule' ? 'regulation' : 'proposal',
                })
            }
        }
    } catch (error) {
        console.error('Failed to fetch FDA Federal Register:', error)
    }

    return updates
}

/**
 * Check California Prop 65 list for new additions
 * Uses multiple strategies with fallbacks for robustness
 */
async function fetchProp65Updates(): Promise<RegulatoryUpdate[]> {
    const updates: RegulatoryUpdate[] = []
    const errors: string[] = []

    // Strategy 1: Try OEHHA's JSON data endpoint (most reliable if available)
    try {
        const jsonResponse = await fetch(
            'https://oehha.ca.gov/proposition-65/proposition-65-list/api/list',
            {
                headers: { 'User-Agent': 'ProductReportCMS/1.0', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000),
            }
        )

        if (jsonResponse.ok) {
            const data = await jsonResponse.json()
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

            // Process JSON data if available
            if (Array.isArray(data)) {
                for (const item of data.slice(0, 50)) {
                    const listingDate = item.listing_date || item.date_added
                    if (listingDate && new Date(listingDate) >= thirtyDaysAgo) {
                        updates.push({
                            source: 'prop65',
                            referenceId: `prop65-${item.id || item.chemical_id || listingDate}`,
                            title: `Prop 65: ${item.chemical_name || item.name || 'Unknown substance'}`,
                            effectiveDate: listingDate,
                            url: 'https://oehha.ca.gov/proposition-65/proposition-65-list',
                            substances: [item.chemical_name || item.name].filter(Boolean),
                            changeType: 'warning',
                        })
                    }
                }

                if (updates.length > 0) {
                    console.log(`[Prop 65] Found ${updates.length} updates via JSON API`)
                    return updates
                }
            }
        }
    } catch (error) {
        errors.push(`JSON API: ${error instanceof Error ? error.message : 'failed'}`)
    }

    // Strategy 2: Try the HTML page with multiple parsing patterns
    try {
        const response = await fetch(
            'https://oehha.ca.gov/proposition-65/proposition-65-list',
            {
                headers: { 'User-Agent': 'ProductReportCMS/1.0' },
                signal: AbortSignal.timeout(15000),
            }
        )

        if (!response.ok) {
            errors.push(`HTML page: HTTP ${response.status}`)
        } else {
            const html = await response.text()

            // Pattern 1: "Added to the list MM/DD/YYYY: Substance"
            const pattern1 = html.match(/Added to the list[^<]*?(\d{1,2}\/\d{1,2}\/\d{4})[^<]*?:([^<]+)/gi)

            // Pattern 2: Date in table cells with substance names
            const pattern2 = html.match(/<td[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi)

            // Pattern 3: List items with dates
            const pattern3 = html.match(/<li[^>]*>[^<]*(\d{1,2}\/\d{1,2}\/\d{4})[^<]*[-–:]([^<]+)<\/li>/gi)

            const allMatches = [...(pattern1 || []), ...(pattern2 || []), ...(pattern3 || [])]

            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            const seenSubstances = new Set<string>()

            for (const match of allMatches.slice(0, 20)) {
                const dateMatch = match.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
                // Extract substance after date or colon
                const substanceMatch = match.match(/(?::|[-–]|<\/td>\s*<td[^>]*>)\s*([^<]+)/i)

                if (dateMatch && substanceMatch) {
                    const substance = substanceMatch[1].trim().replace(/\s+/g, ' ')

                    // Skip if we've seen this substance or if it's too short
                    if (seenSubstances.has(substance.toLowerCase()) || substance.length < 3) {
                        continue
                    }

                    // Check if date is within last 30 days
                    const dateParts = dateMatch[1].split('/')
                    const listingDate = new Date(
                        parseInt(dateParts[2]),
                        parseInt(dateParts[0]) - 1,
                        parseInt(dateParts[1])
                    )

                    if (listingDate >= thirtyDaysAgo) {
                        seenSubstances.add(substance.toLowerCase())
                        updates.push({
                            source: 'prop65',
                            referenceId: `prop65-${dateMatch[1].replace(/\//g, '-')}-${substance.substring(0, 20)}`,
                            title: `Prop 65 Addition: ${substance}`,
                            effectiveDate: dateMatch[1],
                            url: 'https://oehha.ca.gov/proposition-65/proposition-65-list',
                            substances: [substance],
                            changeType: 'warning',
                        })
                    }
                }
            }

            if (updates.length > 0) {
                console.log(`[Prop 65] Found ${updates.length} updates via HTML parsing`)
            }
        }
    } catch (error) {
        errors.push(`HTML page: ${error instanceof Error ? error.message : 'failed'}`)
    }

    // Strategy 3: Check OEHHA news/press releases as fallback
    if (updates.length === 0) {
        try {
            const newsResponse = await fetch(
                'https://oehha.ca.gov/proposition-65/news',
                {
                    headers: { 'User-Agent': 'ProductReportCMS/1.0' },
                    signal: AbortSignal.timeout(10000),
                }
            )

            if (newsResponse.ok) {
                const newsHtml = await newsResponse.text()

                // Look for news items about list additions
                const newsItems = newsHtml.match(/<h\d[^>]*>.*?(?:added|listing|chemical).*?<\/h\d>/gi) || []

                for (const item of newsItems.slice(0, 5)) {
                    const cleanTitle = item.replace(/<[^>]+>/g, '').trim()
                    if (cleanTitle.length > 10) {
                        updates.push({
                            source: 'prop65',
                            referenceId: `prop65-news-${Date.now()}-${updates.length}`,
                            title: `Prop 65 News: ${cleanTitle.substring(0, 100)}`,
                            url: 'https://oehha.ca.gov/proposition-65/news',
                            changeType: 'warning',
                        })
                    }
                }

                if (updates.length > 0) {
                    console.log(`[Prop 65] Found ${updates.length} updates via news page`)
                }
            }
        } catch (error) {
            errors.push(`News page: ${error instanceof Error ? error.message : 'failed'}`)
        }
    }

    // Log errors if all strategies failed
    if (updates.length === 0 && errors.length > 0) {
        console.error('[Prop 65] All fetch strategies failed:', errors.join('; '))
    }

    return updates
}

/**
 * Fetch EU EFSA Journal entries
 */
async function fetchEFSAJournal(): Promise<RegulatoryUpdate[]> {
    const updates: RegulatoryUpdate[] = []

    try {
        // EFSA provides RSS feeds for their journal
        const response = await fetch(
            'https://efsa.onlinelibrary.wiley.com/action/showFeed?jc=18314732&type=etoc',
            { headers: { 'User-Agent': 'ProductReportCMS/1.0' } }
        )

        if (!response.ok) {
            console.error('EFSA Journal error:', response.status)
            return []
        }

        const xml = await response.text()

        // Simple XML parsing for RSS items
        const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || []

        for (const item of items.slice(0, 20)) {
            const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
                              item.match(/<title>(.*?)<\/title>/i)
            const linkMatch = item.match(/<link>(.*?)<\/link>/i)
            const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
                             item.match(/<description>(.*?)<\/description>/i)
            const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i)

            const title = titleMatch?.[1] || ''

            // Filter for food safety related articles
            const isRelevant =
                title.toLowerCase().includes('food') ||
                title.toLowerCase().includes('additive') ||
                title.toLowerCase().includes('contaminant') ||
                title.toLowerCase().includes('pesticide') ||
                title.toLowerCase().includes('safety assessment')

            if (isRelevant && titleMatch && linkMatch) {
                updates.push({
                    source: 'efsa',
                    referenceId: linkMatch[1].split('/').pop() || '',
                    title,
                    summary: descMatch?.[1]?.replace(/<[^>]+>/g, '').substring(0, 500),
                    effectiveDate: dateMatch?.[1] ? new Date(dateMatch[1]).toISOString().split('T')[0] : undefined,
                    url: linkMatch[1],
                    changeType: 'guideline',
                })
            }
        }
    } catch (error) {
        console.error('Failed to fetch EFSA Journal:', error)
    }

    return updates
}

/**
 * Match regulatory update to ingredients in our database
 * NOTE: Disabled - Ingredients collection has been archived
 */
async function matchToIngredients(
    _update: RegulatoryUpdate,
    _payload: Payload
): Promise<number[]> {
    // Ingredients matching disabled - collection archived
    return []
}

export const regulatoryMonitorHandler: PayloadHandler = async (req: PayloadRequest) => {
    // Verify authentication
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    const isAuthenticated = req.user ||
        (cronSecret && authHeader === `Bearer ${cronSecret}`)

    if (!isAuthenticated) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json?.()
        const { sources = ['fda', 'prop65', 'efsa'] } = body || {}

        const results: MonitorResult[] = []

        // Fetch from each source
        for (const source of sources) {
            const result: MonitorResult = {
                success: true,
                source,
                updatesFound: 0,
                newRecordsCreated: 0,
                updates: [],
                errors: [],
            }

            let updates: RegulatoryUpdate[] = []

            switch (source) {
                case 'fda':
                    updates = await fetchFDAFederalRegister()
                    break
                case 'prop65':
                    updates = await fetchProp65Updates()
                    break
                case 'efsa':
                    updates = await fetchEFSAJournal()
                    break
                default:
                    result.errors.push(`Unknown source: ${source}`)
            }

            result.updatesFound = updates.length
            result.updates = updates

            // Store new updates in database
            for (const update of updates) {
                // Check if already exists
                const existing = await (req.payload.find as Function)({
                    collection: 'regulatory-changes',
                    where: {
                        referenceId: { equals: update.referenceId },
                    },
                    limit: 1,
                })

                if (existing.totalDocs === 0) {
                    // Match to ingredients
                    const affectedIngredients = await matchToIngredients(update, req.payload)

                    try {
                        await (req.payload.create as Function)({
                            collection: 'regulatory-changes',
                            data: {
                                title: update.title,
                                referenceId: update.referenceId,
                                source: update.source,
                                sourceUrl: update.url,
                                changeType: update.changeType === 'regulation' ? 'ban' :
                                           update.changeType === 'proposal' ? 'review' :
                                           update.changeType === 'warning' ? 'warning' : 'guideline',
                                summary: update.summary,
                                effectiveDate: update.effectiveDate,
                                affectedIngredients,
                                affectedSubstances: update.substances?.map(name => ({ name })),
                                status: 'pending',
                                rawData: update,
                            },
                        })
                        result.newRecordsCreated++
                    } catch (error) {
                        result.errors.push(`Failed to store ${update.referenceId}: ${error instanceof Error ? error.message : 'unknown'}`)
                    }
                }
            }

            results.push(result)
        }

        // Create audit log
        const totalNew = results.reduce((sum, r) => sum + r.newRecordsCreated, 0)
        const totalFound = results.reduce((sum, r) => sum + r.updatesFound, 0)

        await createAuditLog(req.payload, {
            action: 'freshness_check',
            sourceType: 'system',
            metadata: {
                type: 'regulatory_monitor',
                sources,
                updatesFound: totalFound,
                newRecordsCreated: totalNew,
            },
        })

        console.log(`Regulatory Monitor: Found ${totalFound} updates, created ${totalNew} new records`)

        return Response.json({
            success: true,
            results,
            summary: {
                sourcesChecked: sources.length,
                totalUpdatesFound: totalFound,
                totalNewRecords: totalNew,
            },
        })
    } catch (error) {
        console.error('Regulatory Monitor error:', error)
        return Response.json({
            success: false,
            error: error instanceof Error ? error.message : 'Monitor failed',
        }, { status: 500 })
    }
}

/**
 * Cron job wrapper
 */
export async function runRegulatoryMonitor(payload: Payload): Promise<{
    success: boolean
    updatesFound: number
    newRecords: number
}> {
    try {
        const fda = await fetchFDAFederalRegister()
        const prop65 = await fetchProp65Updates()
        const efsa = await fetchEFSAJournal()

        const allUpdates = [...fda, ...prop65, ...efsa]
        let newRecords = 0

        for (const update of allUpdates) {
            const existing = await (payload.find as Function)({
                collection: 'regulatory-changes',
                where: { referenceId: { equals: update.referenceId } },
                limit: 1,
            })

            if (existing.totalDocs === 0) {
                const affectedIngredients = await matchToIngredients(update, payload)

                await (payload.create as Function)({
                    collection: 'regulatory-changes',
                    data: {
                        title: update.title,
                        referenceId: update.referenceId,
                        source: update.source,
                        sourceUrl: update.url,
                        changeType: 'guideline',
                        summary: update.summary,
                        effectiveDate: update.effectiveDate,
                        affectedIngredients,
                        status: 'pending',
                        rawData: update,
                    },
                })
                newRecords++
            }
        }

        return {
            success: true,
            updatesFound: allUpdates.length,
            newRecords,
        }
    } catch (error) {
        console.error('Regulatory monitor cron failed:', error)
        return {
            success: false,
            updatesFound: 0,
            newRecords: 0,
        }
    }
}
