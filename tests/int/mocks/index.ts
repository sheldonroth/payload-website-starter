/**
 * Test Mocks Index
 *
 * Central export for all test mocks used in integration tests.
 */

export * from './resend.mock'
export * from './revenuecat.mock'
export * from './statsig.mock'

import resendMock, { resetResendMock } from './resend.mock'
import revenuecatMock, { resetRevenueCatMock } from './revenuecat.mock'
import statsigMock, { resetStatsigMock, setupDefaultExperiments, setupDefaultFeatureGates } from './statsig.mock'

/**
 * Reset all mocks - call in beforeEach
 */
export function resetAllMocks(): void {
    resetResendMock()
    resetRevenueCatMock()
    resetStatsigMock()
}

/**
 * Setup all mocks with default configurations
 */
export function setupAllMocks(): void {
    setupDefaultExperiments()
    setupDefaultFeatureGates()
}

export {
    resendMock,
    revenuecatMock,
    statsigMock,
}
