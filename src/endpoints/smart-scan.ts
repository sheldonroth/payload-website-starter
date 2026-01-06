/**
 * Smart Scan AI Vision Endpoint
 * 
 * Uses GPT-4 Vision to analyze any product photo:
 * - Barcode detection → instant lookup
 * - Package recognition → product identification
 * - Shelf photos → multiple product detection
 * 
 * Returns structured data for the mobile app to process.
 */

import { Endpoint } from 'payload';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface SmartScanResult {
    type: 'barcode' | 'product' | 'shelf' | 'ingredient_list' | 'unknown';
    confidence: number;
    products: Array<{
        name: string;
        brand: string;
        barcode?: string;
        confidence: number;
    }>;
    rawText?: string;
    suggestedAction: string;
}

export const smartScanHandler: Endpoint = {
    path: '/smart-scan',
    method: 'post',
    handler: async (req) => {
        const payload = req.payload;

        try {
            if (!req.json) {
                return Response.json({ error: 'Invalid request' }, { status: 400 });
            }
            const body = await req.json();
            const { imageBase64, imageUrl } = body;

            if (!imageBase64 && !imageUrl) {
                return Response.json({ error: 'Image required (base64 or URL)' }, { status: 400 });
            }

            console.log('[SmartScan] Analyzing image...');

            // Build image content for GPT-4 Vision
            const imageContent = imageUrl
                ? { type: 'image_url' as const, image_url: { url: imageUrl } }
                : { type: 'image_url' as const, image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are a product recognition AI for a consumer product safety app. Analyze images to identify:

1. BARCODE: If you see a barcode, extract the numbers if visible
2. PRODUCT: If you see a single product package, identify brand and product name
3. SHELF: If you see multiple products on a shelf or in a cabinet, list all visible products
4. INGREDIENT_LIST: If you see an ingredient list or back of package, extract key information
5. UNKNOWN: If you cannot identify any products

Respond in JSON format only:
{
  "type": "barcode|product|shelf|ingredient_list|unknown",
  "confidence": 0.0-1.0,
  "products": [
    { "name": "Product Name", "brand": "Brand Name", "barcode": "123456789", "confidence": 0.0-1.0 }
  ],
  "rawText": "Any visible text you can read",
  "suggestedAction": "What the user should do next"
}

Be specific with product names. If you're unsure, lower the confidence score.`,
                    },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Analyze this image and identify any products.' },
                            imageContent,
                        ],
                    },
                ],
                max_tokens: 1000,
                temperature: 0.3,
            });

            const content = response.choices[0]?.message?.content || '';

            // Parse JSON response
            let result: SmartScanResult;
            try {
                // Extract JSON from response (may have markdown code blocks)
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                result = jsonMatch ? JSON.parse(jsonMatch[0]) : { type: 'unknown', confidence: 0, products: [], suggestedAction: 'Try scanning a barcode' };
            } catch {
                console.error('[SmartScan] Failed to parse AI response:', content);
                result = { type: 'unknown', confidence: 0, products: [], suggestedAction: 'Try scanning a barcode' };
            }

            console.log(`[SmartScan] Detected: ${result.type} with ${result.products.length} products`);

            // If barcode detected, try to look up in database
            if (result.type === 'barcode' && result.products[0]?.barcode) {
                const barcode = result.products[0].barcode;
                const existingProduct = await payload.find({
                    collection: 'products',
                    where: { barcode: { equals: barcode } },
                    limit: 1,
                });

                if (existingProduct.docs.length > 0) {
                    return Response.json({
                        ...result,
                        matchedProduct: existingProduct.docs[0],
                        suggestedAction: 'View product report',
                    });
                }
            }

            // If product detected, try to match in database
            if ((result.type === 'product' || result.type === 'shelf') && result.products.length > 0) {
                const matchedProducts = [];

                for (const detected of result.products.slice(0, 5)) { // Limit to 5 products
                    // Search by name and brand
                    const search = await payload.find({
                        collection: 'products',
                        where: {
                            or: [
                                { name: { contains: detected.name } },
                                { brand: { contains: detected.brand } },
                            ],
                        },
                        limit: 3,
                    });

                    if (search.docs.length > 0) {
                        matchedProducts.push({
                            detected,
                            matches: search.docs.map((p: any) => ({
                                id: p.id,
                                name: p.name,
                                brand: p.brand,
                                verdict: p.verdict,
                            })),
                        });
                    }
                }

                return Response.json({
                    ...result,
                    matchedProducts,
                    suggestedAction: matchedProducts.length > 0
                        ? 'Select a product to view'
                        : 'No matches found - try scanning barcode',
                });
            }

            return Response.json(result);

        } catch (error) {
            console.error('[SmartScan] Error:', error);
            return Response.json({
                error: 'Analysis failed',
                type: 'unknown',
                confidence: 0,
                products: [],
                suggestedAction: 'Try scanning a barcode instead',
            }, { status: 500 });
        }
    },
};

export default smartScanHandler;
