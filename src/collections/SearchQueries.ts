/**
 * Search Queries Collection
 *
 * Tracks all search queries made on the platform for analytics.
 * Used by the Search Analytics Dashboard to display real search data.
 */

import { CollectionConfig } from 'payload'

export const SearchQueries: CollectionConfig = {
  slug: 'search-queries',
  labels: {
    singular: 'Search Query',
    plural: 'Search Queries',
  },
  admin: {
    useAsTitle: 'query',
    defaultColumns: ['query', 'resultsCount', 'source', 'createdAt'],
    group: 'Analytics',
    description: 'Logged search queries for analytics',
    listSearchableFields: ['query'],
    pagination: {
      defaultLimit: 50,
    },
  },
  access: {
    // Only admins can view search queries
    read: ({ req: { user } }) => !!user,
    create: () => true, // Allow API to create
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: 'query',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'The search query string',
      },
    },
    {
      name: 'resultsCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of results returned',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'web',
      options: [
        { label: 'Website', value: 'web' },
        { label: 'Mobile App', value: 'mobile' },
        { label: 'API', value: 'api' },
      ],
      admin: {
        description: 'Where the search originated',
      },
    },
    {
      name: 'userId',
      type: 'text',
      admin: {
        description: 'User ID if logged in (anonymous if not)',
      },
    },
    {
      name: 'deviceFingerprint',
      type: 'text',
      admin: {
        description: 'Device fingerprint for anonymous tracking',
      },
    },
    {
      name: 'sessionId',
      type: 'text',
      admin: {
        description: 'Session identifier',
      },
    },
    {
      name: 'clickedResult',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether user clicked on a result',
      },
    },
    {
      name: 'clickedProductId',
      type: 'text',
      admin: {
        description: 'Product ID if user clicked a result',
        condition: (data) => data?.clickedResult,
      },
    },
  ],
  timestamps: true,
  // Auto-delete old search queries after 90 days to save space
  // This would be handled by a cron job
}

export default SearchQueries
