import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { Plugin } from 'payload'
import { GenerateTitle, GenerateURL } from '@payloadcms/plugin-seo/types'
import { getServerSideURL } from '@/utilities/getURL'

import { Article } from '@/payload-types'

// SEO only for Articles (Products use custom SEO)
const generateTitle: GenerateTitle<Article> = ({ doc }) => {
  return doc?.title ? `${doc.title} | The Product Report` : 'The Product Report'
}

const generateURL: GenerateURL<Article> = ({ doc }) => {
  const url = getServerSideURL()
  return doc?.slug ? `${url}/articles/${doc.slug}` : url
}

export const plugins: Plugin[] = [
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
  }),
]
