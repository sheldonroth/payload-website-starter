'use client'

import React from 'react'

interface PurchaseLink {
    retailer: string
    url: string
    price?: string
    isAffiliate?: boolean
}

interface AffiliateButtonProps {
    purchaseLinks?: PurchaseLink[]
    productName: string
    affiliateDisclosure?: string
    className?: string
}

export const AffiliateButton: React.FC<AffiliateButtonProps> = ({
    purchaseLinks,
    productName,
    affiliateDisclosure = 'As an Amazon Associate we earn from qualifying purchases.',
    className = '',
}) => {
    if (!purchaseLinks || purchaseLinks.length === 0) {
        return null
    }

    // Find the primary link (prefer Amazon, then first available)
    const amazonLink = purchaseLinks.find(
        (link) => link.retailer.toLowerCase() === 'amazon'
    )
    const primaryLink = amazonLink || purchaseLinks[0]
    const hasAffiliate = purchaseLinks.some((link) => link.isAffiliate)

    const handleClick = (url: string, retailer: string) => {
        // Track click for analytics (optional)
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'affiliate_click', {
                event_category: 'Affiliate',
                event_label: `${productName} - ${retailer}`,
                value: 1,
            })
        }
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    return (
        <div className={`affiliate-button-container ${className}`}>
            {/* Primary Buy Button */}
            <button
                onClick={() => handleClick(primaryLink.url, primaryLink.retailer)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 w-full sm:w-auto"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                </svg>
                Buy on {primaryLink.retailer}
                {primaryLink.price && (
                    <span className="text-green-200 text-sm">({primaryLink.price})</span>
                )}
            </button>

            {/* Additional retailers dropdown if more than one */}
            {purchaseLinks.length > 1 && (
                <div className="mt-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                        Also available at:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {purchaseLinks
                            .filter((link) => link !== primaryLink)
                            .map((link, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleClick(link.url, link.retailer)}
                                    className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                                >
                                    {link.retailer}
                                    {link.price && ` (${link.price})`}
                                </button>
                            ))}
                    </div>
                </div>
            )}

            {/* Affiliate Disclosure */}
            {hasAffiliate && affiliateDisclosure && (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 italic">
                    {affiliateDisclosure}
                </p>
            )}
        </div>
    )
}

export default AffiliateButton
