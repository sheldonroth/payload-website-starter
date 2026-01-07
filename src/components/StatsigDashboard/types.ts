/**
 * Statsig Dashboard Types
 *
 * TypeScript interfaces for Statsig Console API responses
 */

export interface StatsigVariant {
  name: string
  weight: number
  json?: Record<string, unknown>
}

export interface StatsigExperiment {
  id: string
  name: string
  description?: string
  hypothesis?: string
  status: 'active' | 'setup' | 'decision_made' | 'abandoned'
  type?: string
  groups: StatsigVariant[]
  primaryMetric?: string
  primaryMetricType?: string
  targetApps?: string[]
  tags?: string[]
  layerAssignment?: {
    layer: string
    isDefault: boolean
  }
  allocation?: number
  duration?: number
  startTime?: string
  endTime?: string
  lastModifiedTime: string
  creatorName?: string
  creatorID?: string
}

export interface StatsigApiResponse {
  data: StatsigExperiment[]
  message?: string
  cached?: boolean
  lastUpdated?: string
}

export interface ExperimentResults {
  experimentId: string
  status: string
  metrics?: {
    name: string
    variants: {
      name: string
      value: number
      confidenceInterval?: [number, number]
      isWinning?: boolean
    }[]
  }[]
}
