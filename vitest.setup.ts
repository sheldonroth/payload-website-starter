// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

import { beforeEach, afterAll, vi } from 'vitest'
import { resetAllMocks, setupAllMocks } from './tests/int/mocks'

// Set test environment variables
process.env.CRON_SECRET = 'test_cron_secret'
process.env.RESEND_API_KEY = 're_test_api_key'
process.env.RESEND_WEBHOOK_SECRET = 'whsec_test_secret'
process.env.REVENUECAT_WEBHOOK_SECRET = 'rc_test_secret'
process.env.STATSIG_SECRET_KEY = 'secret-test-key'

// Reset mocks before each test
beforeEach(() => {
    resetAllMocks()
})

// Setup default mocks once
setupAllMocks()

// Clean up after all tests
afterAll(() => {
    vi.restoreAllMocks()
})
