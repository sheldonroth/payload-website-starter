import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

interface StatItem {
    label: string
    valueType?: 'manual' | 'products' | 'users' | 'categories' | 'videos' | 'brands'
    manualValue?: string
    suffix?: string
    icon?: 'flask' | 'users' | 'shield' | 'check' | 'star' | 'chart'
}

interface StatsBlockProps {
    id?: string
    heading?: string
    stats?: StatItem[]
    backgroundColor?: 'default' | 'dark' | 'primary'
}

const icons = {
    flask: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
    ),
    users: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    ),
    shield: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    ),
    check: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    star: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
    ),
    chart: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    ),
}

async function getCollectionCount(collection: string): Promise<number> {
    try {
        const payload = await getPayload({ config: configPromise })
        const result = await payload.count({
            collection: collection as any,
            where: collection === 'products' ? { status: { not_equals: 'ai_draft' } } : {},
        })
        return result.totalDocs
    } catch {
        return 0
    }
}

export const StatsBlock: React.FC<StatsBlockProps> = async (props) => {
    const { id, heading, stats, backgroundColor = 'default' } = props

    const statValues = await Promise.all(
        (stats || []).map(async (stat) => {
            if (stat.valueType === 'manual') {
                return stat.manualValue || '0'
            }
            const count = await getCollectionCount(stat.valueType || 'products')
            return count.toString()
        })
    )

    const bgClasses = {
        default: 'bg-gray-50 dark:bg-gray-900',
        dark: 'bg-gray-900 text-white',
        primary: 'bg-green-600 text-white',
    }

    return (
        <section
            id={`block-${id}`}
            className={`py-16 ${bgClasses[backgroundColor as keyof typeof bgClasses] || bgClasses.default}`}
        >
            <div className="container mx-auto px-4">
                {heading && (
                    <h2 className="text-3xl font-bold text-center mb-12">{heading}</h2>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {(stats || []).map((stat, index) => (
                        <div
                            key={index}
                            className="text-center p-6 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
                        >
                            {stat.icon && (
                                <div className="flex justify-center mb-4 text-green-600">
                                    {icons[stat.icon as keyof typeof icons]}
                                </div>
                            )}
                            <div className="text-4xl font-bold mb-2">
                                {statValues[index]}
                                {stat.suffix && <span className="text-2xl">{stat.suffix}</span>}
                            </div>
                            <div className="text-gray-600 dark:text-gray-400 font-medium">
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
