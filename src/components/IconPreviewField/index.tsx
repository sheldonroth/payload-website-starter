'use client'

import React, { useState, useEffect } from 'react'
import { useField } from '@payloadcms/ui'
import { TextInput } from '@payloadcms/ui'
import * as LucideIcons from 'lucide-react'

// Get all valid Lucide icon names
const validIconNames = Object.keys(LucideIcons).filter(
    (key) => key !== 'default' && key !== 'createLucideIcon' && typeof (LucideIcons as any)[key] === 'function'
)

// Convert kebab-case to PascalCase for Lucide lookup
function toPascalCase(str: string): string {
    return str
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join('')
}

interface IconPreviewFieldProps {
    path: string
    field: {
        name: string
        label?: string
        admin?: {
            description?: string
        }
    }
}

const IconPreviewField: React.FC<IconPreviewFieldProps> = ({ path, field }) => {
    const { value, setValue } = useField<string>({ path })
    const [isValid, setIsValid] = useState(true)
    const [IconComponent, setIconComponent] = useState<React.ComponentType<any> | null>(null)

    useEffect(() => {
        if (!value) {
            setIconComponent(null)
            setIsValid(true)
            return
        }

        // Try to find the icon (handle both kebab-case and PascalCase)
        const pascalName = toPascalCase(value)
        const icon = (LucideIcons as any)[pascalName] || (LucideIcons as any)[value]

        if (icon && typeof icon === 'function') {
            setIconComponent(() => icon)
            setIsValid(true)
        } else {
            setIconComponent(null)
            setIsValid(false)
        }
    }, [value])

    return (
        <div style={{ marginBottom: '24px' }}>
            <label
                style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--theme-elevation-800)',
                }}
            >
                {field.label || field.name}
            </label>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* Icon Preview Box */}
                <div
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        background: isValid ? 'var(--theme-elevation-100)' : '#fee2e2',
                        border: `2px solid ${isValid ? 'var(--theme-elevation-200)' : '#ef4444'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    {IconComponent ? (
                        <IconComponent size={24} strokeWidth={2} />
                    ) : value ? (
                        <span style={{ color: '#ef4444', fontSize: '18px' }}>?</span>
                    ) : (
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>--</span>
                    )}
                </div>

                {/* Text Input */}
                <div style={{ flex: 1 }}>
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="e.g., apple, beef, pill, coffee"
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: `1px solid ${isValid ? 'var(--theme-elevation-200)' : '#ef4444'}`,
                            borderRadius: '4px',
                            fontSize: '14px',
                            background: 'var(--theme-input-bg)',
                            color: 'var(--theme-elevation-800)',
                        }}
                    />
                    {!isValid && value && (
                        <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                            Icon "{value}" not found. Browse icons at{' '}
                            <a
                                href="https://lucide.dev/icons"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#3b82f6', textDecoration: 'underline' }}
                            >
                                lucide.dev/icons
                            </a>
                        </p>
                    )}
                    {field.admin?.description && isValid && (
                        <p style={{ color: 'var(--theme-elevation-500)', fontSize: '12px', marginTop: '4px' }}>
                            {field.admin.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Popular Icons Quick Select */}
            <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '11px', color: 'var(--theme-elevation-500)', marginBottom: '6px' }}>
                    Popular icons:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {[
                        'apple', 'beef', 'milk', 'pill', 'coffee', 'wine', 'fish', 'egg',
                        'cookie', 'candy', 'leaf', 'heart', 'baby', 'home', 'sparkles', 'dumbbell'
                    ].map((iconName) => {
                        const Icon = (LucideIcons as any)[toPascalCase(iconName)]
                        return (
                            <button
                                key={iconName}
                                type="button"
                                onClick={() => setValue(iconName)}
                                title={iconName}
                                style={{
                                    padding: '6px',
                                    border: value === iconName ? '2px solid #3b82f6' : '1px solid var(--theme-elevation-200)',
                                    borderRadius: '6px',
                                    background: value === iconName ? '#dbeafe' : 'var(--theme-elevation-50)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {Icon && <Icon size={16} />}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default IconPreviewField
