import type { CollectionConfig } from 'payload'

/**
 * ManufacturerDisputes Collection
 *
 * Part of the Three-Layer Defense System (Right of Reply)
 *
 * This collection stores manufacturer disputes for legal protection.
 * Every dispute submission creates an auditable record proving:
 * 1. We offered manufacturers the opportunity to respond
 * 2. We reviewed their submissions in good faith
 * 3. We updated reports when errors were confirmed
 *
 * LEGAL REQUIREMENT: Records must be retained for 7+ years.
 * Do not delete records without legal counsel approval.
 */
export const ManufacturerDisputes: CollectionConfig = {
  slug: 'manufacturer-disputes',
  labels: {
    singular: 'Manufacturer Dispute',
    plural: 'Manufacturer Disputes',
  },
  admin: {
    useAsTitle: 'referenceNumber',
    defaultColumns: ['referenceNumber', 'companyName', 'disputeType', 'status', 'createdAt'],
    group: 'Legal & Compliance',
    description: 'Manufacturer disputes submitted through the Right of Reply portal. LEGAL RECORD - Do not delete.',
  },
  access: {
    // Only admins can read disputes
    read: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    // Public API can create (form submission)
    create: () => true,
    // Only admins can update
    update: ({ req: { user } }) => (user as { role?: string })?.role === 'admin',
    // Deletion disabled - legal retention requirement
    delete: () => false,
  },
  fields: [
    // ═══════════════════════════════════════════════════════════════════════
    // Reference & Status
    // ═══════════════════════════════════════════════════════════════════════
    {
      name: 'referenceNumber',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique dispute reference (e.g., DIS-2026-ABC123)',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending Review', value: 'pending' },
        { label: 'Under Investigation', value: 'investigating' },
        { label: 'Awaiting Lab Verification', value: 'awaiting_lab' },
        { label: 'Awaiting Manufacturer Response', value: 'awaiting_manufacturer' },
        { label: 'Resolved - Report Updated', value: 'resolved_updated' },
        { label: 'Resolved - No Change Required', value: 'resolved_no_change' },
        { label: 'Resolved - Product Retested', value: 'resolved_retested' },
        { label: 'Closed - Insufficient Information', value: 'closed_insufficient' },
        { label: 'Closed - No Response from Manufacturer', value: 'closed_no_response' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
      admin: {
        position: 'sidebar',
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // Company Information
    // ═══════════════════════════════════════════════════════════════════════
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Company & Contact',
          fields: [
            {
              name: 'companyName',
              type: 'text',
              required: true,
              admin: {
                description: 'Legal company name',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'contactName',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Name of person submitting dispute',
                  },
                },
                {
                  name: 'contactTitle',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Job title',
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'contactEmail',
                  type: 'email',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Corporate email address',
                  },
                },
                {
                  name: 'contactPhone',
                  type: 'text',
                  required: true,
                  admin: {
                    width: '50%',
                    description: 'Phone number',
                  },
                },
              ],
            },
            {
              name: 'emailDomainVerified',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Has the corporate email domain been verified?',
              },
            },
          ],
        },
        {
          label: 'Dispute Details',
          fields: [
            {
              name: 'product',
              type: 'relationship',
              relationTo: 'products',
              admin: {
                description: 'Related product (if identifiable)',
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'productReference',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Product name or URL provided by manufacturer',
                  },
                },
                {
                  name: 'sampleId',
                  type: 'text',
                  admin: {
                    width: '50%',
                    description: 'Sample ID from our report (e.g., TPR-2026-0001)',
                  },
                },
              ],
            },
            {
              name: 'disputeType',
              type: 'select',
              required: true,
              options: [
                { label: 'Methodology Concern', value: 'methodology' },
                { label: 'Sample/Chain of Custody Issue', value: 'sample' },
                { label: 'Data Accuracy Challenge', value: 'accuracy' },
                { label: 'Reformulation Notice', value: 'reformulation' },
                { label: 'Label/Ingredient Update', value: 'label' },
                { label: 'Other', value: 'other' },
              ],
              admin: {
                description: 'Category of dispute',
              },
            },
            {
              name: 'description',
              type: 'textarea',
              required: true,
              admin: {
                description: 'Detailed description provided by manufacturer',
              },
            },
            {
              name: 'supportingDocuments',
              type: 'array',
              admin: {
                description: 'Files uploaded by manufacturer',
              },
              fields: [
                {
                  name: 'document',
                  type: 'upload',
                  relationTo: 'media',
                },
                {
                  name: 'documentDescription',
                  type: 'text',
                },
              ],
            },
          ],
        },
        {
          label: 'Internal Review',
          fields: [
            {
              name: 'assignedTo',
              type: 'relationship',
              relationTo: 'users',
              admin: {
                description: 'Staff member handling this dispute',
              },
            },
            {
              name: 'internalNotes',
              type: 'richText',
              admin: {
                description: 'Internal notes about investigation (not shared with manufacturer)',
              },
            },
            {
              name: 'investigationFindings',
              type: 'richText',
              admin: {
                description: 'Summary of investigation results',
              },
            },
            {
              name: 'labReviewRequested',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Has lab re-verification been requested?',
              },
            },
            {
              name: 'labReviewDate',
              type: 'date',
              admin: {
                description: 'Date lab review was completed',
              },
            },
            {
              name: 'reportUpdated',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Was the published report updated as a result?',
              },
            },
            {
              name: 'updateDescription',
              type: 'textarea',
              admin: {
                description: 'What was changed in the report?',
                condition: (_, siblingData) => siblingData?.reportUpdated,
              },
            },
          ],
        },
        {
          label: 'Response & Resolution',
          fields: [
            {
              name: 'responseToManufacturer',
              type: 'richText',
              admin: {
                description: 'Our official response to the manufacturer',
              },
            },
            {
              name: 'responseDate',
              type: 'date',
              admin: {
                description: 'Date response was sent',
              },
            },
            {
              name: 'responseSentBy',
              type: 'relationship',
              relationTo: 'users',
              admin: {
                description: 'Staff member who sent the response',
              },
            },
            {
              name: 'manufacturerFollowUp',
              type: 'richText',
              admin: {
                description: 'Any follow-up communication from manufacturer',
              },
            },
            {
              name: 'resolutionSummary',
              type: 'textarea',
              admin: {
                description: 'Final summary of how the dispute was resolved',
              },
            },
            {
              name: 'resolvedDate',
              type: 'date',
              admin: {
                description: 'Date dispute was marked resolved',
              },
            },
          ],
        },
        {
          label: 'Audit Trail',
          fields: [
            {
              name: 'submittedAt',
              type: 'date',
              required: true,
              defaultValue: () => new Date().toISOString(),
              admin: {
                readOnly: true,
                description: 'Original submission timestamp',
              },
            },
            {
              name: 'ipAddress',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'IP address of submitter',
              },
            },
            {
              name: 'userAgent',
              type: 'text',
              admin: {
                readOnly: true,
                description: 'Browser/device info',
              },
            },
            {
              name: 'verificationCheckbox',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                readOnly: true,
                description: 'Did manufacturer check the authorization checkbox?',
              },
            },
            {
              name: 'auditLog',
              type: 'array',
              admin: {
                readOnly: true,
                description: 'Chronological log of all actions taken',
              },
              fields: [
                {
                  name: 'timestamp',
                  type: 'date',
                },
                {
                  name: 'action',
                  type: 'text',
                },
                {
                  name: 'performedBy',
                  type: 'relationship',
                  relationTo: 'users',
                },
                {
                  name: 'notes',
                  type: 'textarea',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      // Auto-generate reference number on create
      async ({ data, operation }) => {
        if (operation === 'create' && !data.referenceNumber) {
          const timestamp = Date.now()
          data.referenceNumber = `DIS-${new Date().getFullYear()}-${timestamp.toString(36).toUpperCase()}`
        }
        return data
      },
    ],
    afterChange: [
      // Log status changes to audit trail
      async ({ doc, previousDoc, operation }) => {
        if (operation === 'update' && previousDoc?.status !== doc.status) {
          console.log(`[ManufacturerDispute] ${doc.referenceNumber} status changed: ${previousDoc?.status} -> ${doc.status}`)
        }
      },
    ],
  },
}
