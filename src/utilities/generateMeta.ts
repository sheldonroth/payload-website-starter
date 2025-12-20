import type { Metadata } from 'next'

import type { Media, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  let url = serverUrl + '/website-template-OG.webp'

  if (image && typeof image === 'object' && 'url' in image) {
    const ogUrl = image.sizes?.og?.url

    url = ogUrl ? serverUrl + ogUrl : serverUrl + image.url
  }

  return url
}

interface DocWithMeta {
  title?: string | null
  slug?: string | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: Media | string | number | null
  } | null
}

export const generateMeta = async (args: {
  doc: DocWithMeta | null
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image as Media | null)

  const title = doc?.meta?.title
    ? doc?.meta?.title + ' | The Product Report'
    : doc?.title
      ? doc.title + ' | The Product Report'
      : 'The Product Report'

  return {
    description: doc?.meta?.description || '',
    openGraph: mergeOpenGraph({
      description: doc?.meta?.description || '',
      images: ogImage
        ? [
          {
            url: ogImage,
          },
        ]
        : undefined,
      title,
      url: doc?.slug ? `/${doc.slug}` : '/',
    }),
    title,
  }
}
