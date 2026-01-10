/**
 * Content Generator Endpoint
 * 
 * AI-powered content generation that creates:
 * - Listicles
 * - TikTok/Shorts scripts
 * - Comparison snippets
 * - Controversy articles
 * 
 * All content is saved to GeneratedContent collection for review.
 * Includes legal review prompts to ensure compliance.
 */

import { Endpoint } from 'payload';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Legal review prefix that MUST be included in all prompts
const LEGAL_REVIEW_PREFIX = `
CRITICAL LEGAL GUIDELINES - You MUST follow these rules:

1. NEVER accuse brands of lying, deceiving, or committing fraud
2. NEVER make health claims without scientific citation
3. ALWAYS use factual language: "Our testing showed..." NOT "They hid..."
4. ALWAYS include methodology reference
5. ALWAYS use "we recommend" or "we don't recommend" - NEVER "safe" or "unsafe"
6. AVOID superlatives like "worst ever" or "most dangerous"
7. If content could be legally risky, add [LEGAL REVIEW NEEDED] flag
8. For controversy content: offer brands right of response

Remember: We can share what we FOUND in testing, but we cannot make claims about brand intent or product safety.
`;

interface ContentRequest {
    type: 'listicle' | 'tiktok_script' | 'comparison' | 'controversy' | 'product_review';
    category?: string;
    products?: string[]; // Product IDs
    title?: string;
    context?: string;
}

export const contentGeneratorHandler = async (req: any) => {
    try {
        const body = await req.json();
        const { type, category, products, title, context } = body as ContentRequest;
        const payload = req.payload;

        if (!type) {
            return Response.json({ error: 'Content type required' }, { status: 400 });
        }

        // Fetch product data if IDs provided
        let productData: any[] = [];
        if (products && products.length > 0) {
            const productDocs = await payload.find({
                collection: 'products',
                where: { id: { in: products } },
                limit: 20,
            });
            productData = productDocs.docs;
        }

        // Fetch category products if category provided
        if (category && productData.length === 0) {
            const categoryDoc = await payload.find({
                collection: 'categories',
                where: { slug: { equals: category } },
                limit: 1,
            });

            if (categoryDoc.docs.length > 0) {
                const categoryProducts = await payload.find({
                    collection: 'products',
                    where: { category: { equals: categoryDoc.docs[0].id } },
                    limit: 20,
                });
                productData = categoryProducts.docs;
            }
        }

        // Generate content based on type
        let generatedContent: any;

        switch (type) {
            case 'listicle':
                generatedContent = await generateListicle(productData, category, title);
                break;
            case 'tiktok_script':
                generatedContent = await generateTikTokScript(productData, context);
                break;
            case 'comparison':
                generatedContent = await generateComparison(productData);
                break;
            case 'controversy':
                generatedContent = await generateControversy(productData, context);
                break;
            case 'product_review':
                generatedContent = await generateProductReview(productData[0]);
                break;
            default:
                return Response.json({ error: 'Invalid content type' }, { status: 400 });
        }

        // Save to GeneratedContent collection for review
        const savedContent = await payload.create({
            collection: 'generated-content',
            data: {
                title: generatedContent.title,
                contentType: type,
                status: 'pending_review',
                content: generatedContent.content,
                script: generatedContent.script,
                listicleItems: generatedContent.listicleItems,
                comparison: generatedContent.comparison,
                relatedProducts: products,
                seo: generatedContent.seo,
                generationMetadata: {
                    generatedAt: new Date().toISOString(),
                    generatedBy: 'gpt-4o',
                    trigger: context || 'manual',
                },
                legalFlags: generatedContent.needsLegalReview ? ['needs_citation'] : [],
            },
        });

        return Response.json({
            success: true,
            contentId: savedContent.id,
            preview: generatedContent,
            message: 'Content generated and saved for review',
        });

    } catch (error) {
        console.error('[ContentGenerator] Error:', error);
        return Response.json(
            { error: 'Failed to generate content', details: String(error) },
            { status: 500 }
        );
    }
};

async function generateListicle(products: any[], category?: string, customTitle?: string) {
    const recommended = products.filter(p => p.verdict === 'recommended' || p.verdict === 'buy');
    const avoid = products.filter(p => p.verdict === 'avoid' || p.verdict === 'dontbuy');

    const prompt = `${LEGAL_REVIEW_PREFIX}

Generate a listicle article about ${category || 'products'}.

Products we RECOMMEND (based on our lab testing):
${recommended.map(p => `- ${p.name} by ${p.brand}`).join('\n')}

Products we DON'T RECOMMEND (based on our lab testing):
${avoid.map(p => `- ${p.name} by ${p.brand}`).join('\n')}

${customTitle ? `Suggested title direction: ${customTitle}` : ''}

Generate:
1. A compelling title (use numbers, be specific)
2. An introduction (2-3 sentences explaining what we tested)
3. For each product: a brief description of what our testing showed

Format as JSON:
{
  "title": "string",
  "introduction": "string",
  "items": [
    {"rank": 1, "name": "string", "brand": "string", "verdict": "recommended|avoid", "description": "string"}
  ],
  "conclusion": "string",
  "needsLegalReview": boolean
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
    });

    let content: any = {};
    try {
        content = JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (parseError) {
        console.error('[ContentGenerator] Failed to parse AI response:', parseError);
        // Return empty content on parse failure
    }

    return {
        title: content.title,
        content: content.introduction + '\n\n' + content.conclusion,
        listicleItems: content.items?.map((item: any, i: number) => ({
            rank: item.rank || i + 1,
            heading: `${item.name} by ${item.brand}`,
            description: item.description,
            verdict: item.verdict,
        })),
        seo: {
            metaTitle: content.title,
            metaDescription: content.introduction?.substring(0, 160),
        },
        needsLegalReview: content.needsLegalReview,
    };
}

async function generateTikTokScript(products: any[], context?: string) {
    const product = products[0]; // Focus on one product for TikTok

    const prompt = `${LEGAL_REVIEW_PREFIX}

Generate a 30-second TikTok script about this product:

Product: ${product?.name || 'a popular product'}
Brand: ${product?.brand || 'Unknown'}
Our Verdict: ${product?.verdict === 'recommended' ? 'We recommend it' : 'We don\'t recommend it'}
${context ? `Context: ${context}` : ''}

Create a script with:
1. HOOK (0-3 seconds): Grab attention, create curiosity
2. BUILD (3-15 seconds): Set up the reveal
3. REVEAL (15-25 seconds): Share what our testing found
4. CTA (25-30 seconds): Direct to link in bio

Remember: Only say "we recommend" or "we don't recommend" - never "safe" or "unsafe"

Format as JSON:
{
  "title": "string",
  "hook": "string",
  "build": "string", 
  "reveal": "string",
  "cta": "string",
  "estimatedDuration": "30",
  "visualNotes": "string",
  "needsLegalReview": boolean
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' },
    });

    const content = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
        title: content.title || `TikTok: ${product?.name || 'Product Reveal'}`,
        content: `**HOOK:** ${content.hook}\n\n**BUILD:** ${content.build}\n\n**REVEAL:** ${content.reveal}\n\n**CTA:** ${content.cta}`,
        script: {
            hook: content.hook,
            build: content.build,
            reveal: content.reveal,
            cta: content.cta,
            estimatedDuration: '30',
            platform: ['tiktok', 'reels', 'shorts'],
        },
        needsLegalReview: content.needsLegalReview,
    };
}

async function generateComparison(products: any[]) {
    if (products.length < 2) {
        throw new Error('Need at least 2 products for comparison');
    }

    const [productA, productB] = products;

    const prompt = `${LEGAL_REVIEW_PREFIX}

Generate a comparison between these two products based on our lab testing:

Product A: ${productA.name} by ${productA.brand}
- Our Verdict: ${productA.verdict === 'recommended' ? 'Recommended' : 'Not Recommended'}

Product B: ${productB.name} by ${productB.brand}
- Our Verdict: ${productB.verdict === 'recommended' ? 'Recommended' : 'Not Recommended'}

Create a fair, factual comparison focusing on:
1. What our testing revealed about each
2. Key differences
3. Which we recommend (or if we recommend both/neither)

Remember: Stick to facts from testing. No claims about safety.

Format as JSON:
{
  "title": "string",
  "introduction": "string",
  "keyDifferences": [
    {"factor": "string", "productAValue": "string", "productBValue": "string"}
  ],
  "verdict": "a_recommended|b_recommended|both_recommended|neither_recommended",
  "conclusion": "string",
  "needsLegalReview": boolean
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
    });

    const content = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
        title: content.title || `${productA.name} vs ${productB.name}`,
        content: content.introduction + '\n\n' + content.conclusion,
        comparison: {
            verdict: content.verdict,
            keyDifferences: content.keyDifferences,
        },
        seo: {
            metaTitle: `${productA.name} vs ${productB.name}: Lab Test Comparison`,
            metaDescription: content.introduction?.substring(0, 160),
        },
        needsLegalReview: content.needsLegalReview,
    };
}

async function generateControversy(products: any[], context?: string) {
    const product = products[0];

    const prompt = `${LEGAL_REVIEW_PREFIX}

[THIS CONTENT REQUIRES EXTRA LEGAL REVIEW]

Generate a controversy article about this product:

Product: ${product?.name || 'Unknown'}
Brand: ${product?.brand || 'Unknown'}
${context ? `Context/Angle: ${context}` : ''}

This brand markets the product as [clean/natural/safe]. Our lab testing revealed findings that users should know about.

Structure:
1. What the brand claims
2. What our lab testing showed (factual findings only)
3. What this means (educational, not accusatory)
4. Our verdict (recommend or don't recommend)
5. Brand response placeholder

CRITICAL: 
- No accusations of lying or deception
- Only state what testing FOUND
- Offer brand right to respond
- Flag anything that needs legal review

Format as JSON:
{
  "title": "string",
  "brandClaims": "string",
  "ourFindings": "string",
  "whatThisMeans": "string",
  "verdict": "recommended|avoid",
  "brandResponsePlaceholder": "We reached out to [Brand] for comment.",
  "needsLegalReview": true
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' },
    });

    const content = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
        title: content.title || `What Our Lab Found In ${product?.name}`,
        content: `## What ${product?.brand} Claims\n${content.brandClaims}\n\n## What Our Lab Testing Showed\n${content.ourFindings}\n\n## What This Means\n${content.whatThisMeans}\n\n## Our Verdict\n${content.verdict === 'recommended' ? 'We recommend this product.' : 'We don\'t recommend this product.'}\n\n## Brand Response\n${content.brandResponsePlaceholder}`,
        seo: {
            metaTitle: content.title,
            metaDescription: `Our lab tested ${product?.name}. Here's what we found.`,
        },
        needsLegalReview: true, // Always needs review for controversy
    };
}

async function generateProductReview(product: any) {
    if (!product) {
        throw new Error('Product required for review');
    }

    const prompt = `${LEGAL_REVIEW_PREFIX}

Generate an SEO-optimized product review page for:

Product: ${product.name}
Brand: ${product.brand}
Category: ${product.category || 'Unknown'}
Our Verdict: ${product.verdict === 'recommended' ? 'Recommended' : 'Not Recommended'}

Create:
1. H1 title optimized for "[product name] review" searches
2. Introduction summarizing our verdict
3. Key findings from our testing
4. FAQ section (3-4 questions people search for)

Remember: Use "recommend/don't recommend" not "safe/unsafe"

Format as JSON:
{
  "title": "string",
  "introduction": "string",
  "keyFindings": ["string"],
  "verdict": "We recommend this product.|We don't recommend this product.",
  "faq": [
    {"question": "string", "answer": "string"}
  ],
  "metaTitle": "string",
  "metaDescription": "string",
  "needsLegalReview": boolean
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
    });

    const content = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
        title: content.title || `${product.name} Review: Lab Test Results`,
        content: `${content.introduction}\n\n## Key Findings\n${content.keyFindings?.map((f: string) => `- ${f}`).join('\n')}\n\n## Our Verdict\n${content.verdict}\n\n## FAQ\n${content.faq?.map((f: any) => `### ${f.question}\n${f.answer}`).join('\n\n')}`,
        seo: {
            metaTitle: content.metaTitle,
            metaDescription: content.metaDescription,
            targetKeywords: [
                { keyword: `${product.name} review` },
                { keyword: `is ${product.name} good` },
                { keyword: `${product.brand} products` },
            ],
        },
        needsLegalReview: content.needsLegalReview,
    };
}

export default contentGeneratorHandler;
