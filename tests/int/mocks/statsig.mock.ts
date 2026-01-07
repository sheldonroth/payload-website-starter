/**
 * Statsig Mock for Integration Tests
 *
 * Mocks the Statsig SDK for:
 * - Feature gate evaluation
 * - Experiment variant assignment
 * - Dynamic config retrieval
 * - Event logging
 */

import { vi } from 'vitest'

export interface MockExperiment {
    name: string
    variants: string[]
    activeVariant: string
    allocation: number // 0-100
}

export interface MockFeatureGate {
    name: string
    enabled: boolean
    rules?: {
        passPercentage: number
        conditions: Array<{
            type: 'user_id' | 'app_version' | 'custom'
            targetValue: string | string[]
        }>
    }
}

export interface MockDynamicConfig {
    name: string
    value: Record<string, any>
}

export interface LoggedEvent {
    eventName: string
    value?: number | string
    metadata?: Record<string, any>
    userId?: string
    timestamp: Date
}

export interface StatsigMockState {
    experiments: Map<string, MockExperiment>
    featureGates: Map<string, MockFeatureGate>
    dynamicConfigs: Map<string, MockDynamicConfig>
    loggedEvents: LoggedEvent[]
    userOverrides: Map<string, Map<string, string>> // userId -> experimentName -> variant
}

const state: StatsigMockState = {
    experiments: new Map(),
    featureGates: new Map(),
    dynamicConfigs: new Map(),
    loggedEvents: [],
    userOverrides: new Map(),
}

/**
 * Mock Statsig client
 */
export const mockStatsig = {
    initialize: vi.fn(async () => true),

    shutdown: vi.fn(async () => undefined),

    checkGate: vi.fn((user: { userID: string }, gateName: string): boolean => {
        const gate = state.featureGates.get(gateName)
        if (!gate) return false
        return gate.enabled
    }),

    getExperiment: vi.fn((user: { userID: string }, experimentName: string) => {
        const experiment = state.experiments.get(experimentName)
        if (!experiment) {
            return { get: () => null, getValue: () => null }
        }

        // Check for user override
        const userOverrides = state.userOverrides.get(user.userID)
        const overrideVariant = userOverrides?.get(experimentName)

        const variant = overrideVariant || experiment.activeVariant

        return {
            get: (key: string, defaultValue: any) => {
                if (key === 'variant') return variant
                return defaultValue
            },
            getValue: (key: string, defaultValue: any) => {
                if (key === 'variant') return variant
                return defaultValue
            },
            getGroupName: () => variant,
        }
    }),

    getConfig: vi.fn((user: { userID: string }, configName: string) => {
        const config = state.dynamicConfigs.get(configName)
        if (!config) {
            return { get: () => null, getValue: () => null }
        }

        return {
            get: (key: string, defaultValue: any) => config.value[key] ?? defaultValue,
            getValue: (key: string, defaultValue: any) => config.value[key] ?? defaultValue,
        }
    }),

    logEvent: vi.fn((user: { userID: string }, eventName: string, value?: number | string, metadata?: Record<string, any>) => {
        state.loggedEvents.push({
            eventName,
            value,
            metadata,
            userId: user.userID,
            timestamp: new Date(),
        })
    }),

    flush: vi.fn(async () => undefined),
}

/**
 * Reset mock state between tests
 */
export function resetStatsigMock(): void {
    state.experiments.clear()
    state.featureGates.clear()
    state.dynamicConfigs.clear()
    state.loggedEvents = []
    state.userOverrides.clear()

    mockStatsig.initialize.mockClear()
    mockStatsig.shutdown.mockClear()
    mockStatsig.checkGate.mockClear()
    mockStatsig.getExperiment.mockClear()
    mockStatsig.getConfig.mockClear()
    mockStatsig.logEvent.mockClear()
    mockStatsig.flush.mockClear()
}

/**
 * Add a feature gate to the mock
 */
export function addMockFeatureGate(gate: MockFeatureGate): void {
    state.featureGates.set(gate.name, gate)
}

/**
 * Enable a feature gate
 */
export function enableFeatureGate(gateName: string): void {
    const existing = state.featureGates.get(gateName)
    state.featureGates.set(gateName, { name: gateName, enabled: true, ...existing })
}

/**
 * Disable a feature gate
 */
export function disableFeatureGate(gateName: string): void {
    const existing = state.featureGates.get(gateName)
    state.featureGates.set(gateName, { name: gateName, enabled: false, ...existing })
}

/**
 * Add an experiment to the mock
 */
export function addMockExperiment(experiment: MockExperiment): void {
    state.experiments.set(experiment.name, experiment)
}

/**
 * Set the active variant for an experiment
 */
export function setExperimentVariant(experimentName: string, variant: string): void {
    const experiment = state.experiments.get(experimentName)
    if (experiment) {
        experiment.activeVariant = variant
    }
}

/**
 * Override experiment variant for a specific user
 */
export function setUserExperimentOverride(userId: string, experimentName: string, variant: string): void {
    if (!state.userOverrides.has(userId)) {
        state.userOverrides.set(userId, new Map())
    }
    state.userOverrides.get(userId)!.set(experimentName, variant)
}

/**
 * Add a dynamic config to the mock
 */
export function addMockDynamicConfig(config: MockDynamicConfig): void {
    state.dynamicConfigs.set(config.name, config)
}

/**
 * Get all logged events
 */
export function getLoggedEvents(): LoggedEvent[] {
    return [...state.loggedEvents]
}

/**
 * Get logged events by name
 */
export function getLoggedEventsByName(eventName: string): LoggedEvent[] {
    return state.loggedEvents.filter(e => e.eventName === eventName)
}

/**
 * Get logged events for a user
 */
export function getLoggedEventsForUser(userId: string): LoggedEvent[] {
    return state.loggedEvents.filter(e => e.userId === userId)
}

/**
 * Clear logged events
 */
export function clearLoggedEvents(): void {
    state.loggedEvents = []
}

/**
 * Install the Statsig mock globally
 */
export function installStatsigMock(): void {
    vi.mock('statsig-node', () => ({
        default: mockStatsig,
        Statsig: mockStatsig,
    }))
}

/**
 * Create common test experiments
 */
export function setupDefaultExperiments(): void {
    addMockExperiment({
        name: 'email_subject_test',
        variants: ['control', 'variant_a', 'variant_b'],
        activeVariant: 'control',
        allocation: 100,
    })

    addMockExperiment({
        name: 'onboarding_flow',
        variants: ['original', 'simplified', 'gamified'],
        activeVariant: 'original',
        allocation: 100,
    })

    addMockExperiment({
        name: 'pricing_display',
        variants: ['monthly_first', 'annual_first', 'comparison'],
        activeVariant: 'monthly_first',
        allocation: 100,
    })
}

/**
 * Create common test feature gates
 */
export function setupDefaultFeatureGates(): void {
    addMockFeatureGate({
        name: 'premium_features',
        enabled: false,
    })

    addMockFeatureGate({
        name: 'new_scanner_ui',
        enabled: false,
    })

    addMockFeatureGate({
        name: 'ai_recommendations',
        enabled: true,
    })
}

export default {
    mockStatsig,
    resetStatsigMock,
    addMockFeatureGate,
    enableFeatureGate,
    disableFeatureGate,
    addMockExperiment,
    setExperimentVariant,
    setUserExperimentOverride,
    addMockDynamicConfig,
    getLoggedEvents,
    getLoggedEventsByName,
    getLoggedEventsForUser,
    clearLoggedEvents,
    installStatsigMock,
    setupDefaultExperiments,
    setupDefaultFeatureGates,
}
