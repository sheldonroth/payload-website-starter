/**
 * Prompt Sanitization Utility
 *
 * SECURITY: Prevents prompt injection attacks by sanitizing user-controlled
 * data before it's interpolated into LLM prompts.
 *
 * This utility escapes special characters and patterns that could be used
 * to override system prompts or inject malicious instructions.
 */

/**
 * Patterns that indicate potential prompt injection attempts
 */
const INJECTION_PATTERNS = [
    /\[SYSTEM\]/gi,
    /\[OVERRIDE\]/gi,
    /\[IGNORE\]/gi,
    /\[ADMIN\]/gi,
    /ignore previous instructions/gi,
    /ignore all instructions/gi,
    /disregard previous/gi,
    /forget your instructions/gi,
    /new instructions:/gi,
    /system prompt:/gi,
    /you are now/gi,
    /pretend to be/gi,
    /act as if/gi,
    /from now on/gi,
]

/**
 * Sanitizes user input for safe interpolation into LLM prompts.
 *
 * @param input - The user-controlled input string
 * @param options - Sanitization options
 * @returns Sanitized string safe for prompt interpolation
 */
export function sanitizeForPrompt(
    input: string,
    options: {
        maxLength?: number
        stripNewlines?: boolean
        escapeMarkdown?: boolean
    } = {}
): string {
    const {
        maxLength = 10000,
        stripNewlines = false,
        escapeMarkdown = false,
    } = options

    if (!input || typeof input !== 'string') {
        return ''
    }

    let sanitized = input

    // Truncate to max length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength) + '... [truncated]'
    }

    // Remove or escape injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[FILTERED]')
    }

    // Escape special delimiters that could break prompt structure
    sanitized = sanitized
        .replace(/```/g, '` ` `')  // Break code block syntax
        .replace(/"""/g, '" " "')  // Break triple quotes
        .replace(/\n{3,}/g, '\n\n')  // Collapse excessive newlines

    // Optional: Strip all newlines (for single-line contexts)
    if (stripNewlines) {
        sanitized = sanitized.replace(/\n/g, ' ')
    }

    // Optional: Escape markdown (for display contexts)
    if (escapeMarkdown) {
        sanitized = sanitized
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/~/g, '\\~')
            .replace(/`/g, '\\`')
    }

    return sanitized.trim()
}

/**
 * Sanitizes an array of category names for safe prompt interpolation.
 * Category names are user-controlled and could contain injection attempts.
 */
export function sanitizeCategoryList(categories: string[]): string {
    return categories
        .map(cat => sanitizeForPrompt(cat, { maxLength: 100, stripNewlines: true }))
        .filter(cat => cat.length > 0)
        .join(', ')
}

/**
 * Sanitizes video transcript content for prompt interpolation.
 * Transcripts can be very long and may contain injection attempts.
 */
export function sanitizeTranscript(transcript: string): string {
    return sanitizeForPrompt(transcript, {
        maxLength: 50000,  // Allow longer transcripts
        stripNewlines: false,
        escapeMarkdown: false,
    })
}

/**
 * Sanitizes product/brand names for prompt interpolation.
 */
export function sanitizeProductName(name: string): string {
    return sanitizeForPrompt(name, {
        maxLength: 200,
        stripNewlines: true,
    })
}

/**
 * Wraps user content in XML-style tags to help LLMs distinguish
 * between instructions and user content. This is a defense-in-depth measure.
 */
export function wrapUserContent(content: string, label: string = 'USER_CONTENT'): string {
    const sanitized = sanitizeForPrompt(content)
    return `<${label}>\n${sanitized}\n</${label}>`
}
