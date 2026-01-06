/**
 * Shelf Scan AI Endpoint
 * 
 * Receives a base64 image of a shelf/pantry and uses OpenAI Vision
 * to detect all visible products, returning names and brands.
 */

import { Endpoint } from 'payload';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface DetectedProduct {
    name: string;
    brand: string;
    confidence: number; // 0-1
    category?: string;
}

export const shelfScan: Endpoint = {
    path: '/shelf-scan',
    method: 'post',
    handler: async (req) => {
        try {
            const body = await req.json();
            const { image } = body;

            if (!image) {
                return Response.json(
                    { error: 'No image provided' },
                    { status: 400 }
                );
            }

            const prompt = `Analyze this image of a shelf or pantry and identify all visible consumer products.

For each product you can see, provide:
1. The product name (be specific, e.g., "Tide Original Liquid Laundry Detergent" not just "detergent")
2. The brand name
3. Your confidence level (0.0 to 1.0) in the identification
4. The product category (personal care, food, beverage, cleaning, baby, pet, supplements, cosmetics, other)

Return your response as a JSON array of products. Only include products you can reasonably identify.
If you cannot identify any products, return an empty array.

Example format:
[
  {"name": "Original Liquid Laundry Detergent 64oz", "brand": "Tide", "confidence": 0.95, "category": "cleaning"},
  {"name": "Strawberry Greek Yogurt", "brand": "Chobani", "confidence": 0.85, "category": "food"}
]

Be thorough - scan the entire image and list everything you can identify.`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`,
                                    detail: 'high',
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 2000,
                temperature: 0.3,
            });

            const content = response.choices[0]?.message?.content || '[]';

            // Parse the JSON response
            let products: DetectedProduct[] = [];
            try {
                // Try to extract JSON from the response
                const jsonMatch = content.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    products = JSON.parse(jsonMatch[0]);
                }
            } catch (parseError) {
                console.error('[ShelfScan] Failed to parse AI response:', parseError);
                console.error('[ShelfScan] Raw content:', content);
            }

            // Validate and clean products
            const cleanedProducts = products
                .filter((p) => p.name && p.brand)
                .map((p) => ({
                    name: String(p.name).trim(),
                    brand: String(p.brand).trim(),
                    confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0.5)),
                    category: p.category || 'other',
                }));

            console.log(`[ShelfScan] Detected ${cleanedProducts.length} products`);

            return Response.json({
                success: true,
                products: cleanedProducts,
                totalDetected: cleanedProducts.length,
                processingModel: 'gpt-4o',
            });

        } catch (error) {
            console.error('[ShelfScan] Error:', error);
            return Response.json(
                { error: 'Failed to analyze image', details: String(error) },
                { status: 500 }
            );
        }
    },
};

export default shelfScan;
