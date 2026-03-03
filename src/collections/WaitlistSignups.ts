import type { CollectionConfig } from 'payload'

export const WaitlistSignups: CollectionConfig = {
  slug: 'waitlist-signups',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'createdAt'],
    description: 'Email waitlist signups from theproductreport.com',
  },
  access: {
    create: () => true, // Public — anyone can sign up
    read: ({ req }) => !!req.user, // Admin only
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
    },
    {
      name: 'source',
      type: 'text',
      defaultValue: 'website',
    },
  ],
}
