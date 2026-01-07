/**
 * JSON-LD Structured Data Generation
 *
 * Generates Schema.org compliant JSON-LD for better SEO and rich snippets.
 * Supports: Product, Article, Organization, WebSite, BreadcrumbList
 */

import { getServerSideURL } from './getURL'

interface OrganizationSchema {
    '@context': 'https://schema.org'
    '@type': 'Organization'
    name: string
    url: string
    logo?: string
    sameAs?: string[]
    contactPoint?: {
        '@type': 'ContactPoint'
        email: string
        contactType: string
    }
}

interface WebSiteSchema {
    '@context': 'https://schema.org'
    '@type': 'WebSite'
    name: string
    url: string
    potentialAction?: {
        '@type': 'SearchAction'
        target: {
            '@type': 'EntryPoint'
            urlTemplate: string
        }
        'query-input': string
    }
}

interface ProductSchema {
    '@context': 'https://schema.org'
    '@type': 'Product'
    name: string
    description?: string
    image?: string | string[]
    brand?: {
        '@type': 'Brand'
        name: string
    }
    sku?: string
    gtin?: string
    category?: string
    review?: {
        '@type': 'Review'
        reviewRating: {
            '@type': 'Rating'
            ratingValue: number
            bestRating: number
            worstRating: number
        }
        author: {
            '@type': 'Organization'
            name: string
        }
    }
    aggregateRating?: {
        '@type': 'AggregateRating'
        ratingValue: number
        bestRating: number
        reviewCount: number
    }
}

interface ArticleSchema {
    '@context': 'https://schema.org'
    '@type': 'Article' | 'NewsArticle' | 'BlogPosting'
    headline: string
    description?: string
    image?: string | string[]
    datePublished?: string
    dateModified?: string
    author?: {
        '@type': 'Organization' | 'Person'
        name: string
        url?: string
    }
    publisher?: {
        '@type': 'Organization'
        name: string
        logo?: {
            '@type': 'ImageObject'
            url: string
        }
    }
    mainEntityOfPage?: {
        '@type': 'WebPage'
        '@id': string
    }
}

interface BreadcrumbSchema {
    '@context': 'https://schema.org'
    '@type': 'BreadcrumbList'
    itemListElement: {
        '@type': 'ListItem'
        position: number
        name: string
        item?: string
    }[]
}

// Default organization info
const DEFAULT_ORG = {
    name: 'The Product Report',
    url: getServerSideURL(),
    logo: `${getServerSideURL()}/logo.png`,
}

/**
 * Generate Organization schema (for homepage/global)
 */
export function generateOrganizationSchema(
    overrides?: Partial<OrganizationSchema>
): OrganizationSchema {
    return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: DEFAULT_ORG.name,
        url: DEFAULT_ORG.url,
        logo: DEFAULT_ORG.logo,
        contactPoint: {
            '@type': 'ContactPoint',
            email: 'support@theproductreport.org',
            contactType: 'customer service',
        },
        ...overrides,
    }
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebSiteSchema(): WebSiteSchema {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: DEFAULT_ORG.name,
        url: DEFAULT_ORG.url,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${DEFAULT_ORG.url}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    }
}

/**
 * Generate Product schema for product pages
 */
export function generateProductSchema(product: {
    name: string
    description?: string
    image?: string | null
    barcode?: string
    brand?: string | null
    category?: string | null
    score?: number | null
    reviewCount?: number
}): ProductSchema {
    const schema: ProductSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
    }

    if (product.description) {
        schema.description = product.description
    }

    if (product.image) {
        schema.image = product.image
    }

    if (product.brand) {
        schema.brand = {
            '@type': 'Brand',
            name: product.brand,
        }
    }

    if (product.barcode) {
        // Determine if UPC or EAN
        if (product.barcode.length === 12) {
            schema.gtin = product.barcode // UPC-A
        } else if (product.barcode.length === 13) {
            schema.gtin = product.barcode // EAN-13
        }
        schema.sku = product.barcode
    }

    if (product.category) {
        schema.category = product.category
    }

    // Add rating if score exists
    if (typeof product.score === 'number') {
        schema.review = {
            '@type': 'Review',
            reviewRating: {
                '@type': 'Rating',
                ratingValue: product.score / 20, // Convert 0-100 to 0-5
                bestRating: 5,
                worstRating: 1,
            },
            author: {
                '@type': 'Organization',
                name: DEFAULT_ORG.name,
            },
        }

        if (product.reviewCount) {
            schema.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: product.score / 20,
                bestRating: 5,
                reviewCount: product.reviewCount,
            }
        }
    }

    return schema
}

/**
 * Generate Article schema for blog posts and news
 */
export function generateArticleSchema(article: {
    title: string
    description?: string
    image?: string | null
    publishedAt?: string
    updatedAt?: string
    author?: string | null
    type?: 'Article' | 'NewsArticle' | 'BlogPosting'
    url: string
}): ArticleSchema {
    const schema: ArticleSchema = {
        '@context': 'https://schema.org',
        '@type': article.type || 'Article',
        headline: article.title,
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': article.url,
        },
        publisher: {
            '@type': 'Organization',
            name: DEFAULT_ORG.name,
            logo: {
                '@type': 'ImageObject',
                url: DEFAULT_ORG.logo,
            },
        },
    }

    if (article.description) {
        schema.description = article.description
    }

    if (article.image) {
        schema.image = article.image
    }

    if (article.publishedAt) {
        schema.datePublished = article.publishedAt
    }

    if (article.updatedAt) {
        schema.dateModified = article.updatedAt
    }

    if (article.author) {
        schema.author = {
            '@type': 'Person',
            name: article.author,
        }
    } else {
        schema.author = {
            '@type': 'Organization',
            name: DEFAULT_ORG.name,
            url: DEFAULT_ORG.url,
        }
    }

    return schema
}

/**
 * Generate BreadcrumbList schema for navigation context
 */
export function generateBreadcrumbSchema(
    items: { name: string; url?: string }[]
): BreadcrumbSchema {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem' as const,
            position: index + 1,
            name: item.name,
            ...(item.url && index < items.length - 1 ? { item: item.url } : {}),
        })),
    }
}

/**
 * Serialize JSON-LD for use in <script> tag
 */
export function serializeJsonLd(
    schema: OrganizationSchema | WebSiteSchema | ProductSchema | ArticleSchema | BreadcrumbSchema
): string {
    return JSON.stringify(schema)
}

/**
 * Generate combined JSON-LD for pages that need multiple schemas
 */
export function generateCombinedJsonLd(
    schemas: (OrganizationSchema | WebSiteSchema | ProductSchema | ArticleSchema | BreadcrumbSchema)[]
): string {
    return JSON.stringify(schemas)
}
