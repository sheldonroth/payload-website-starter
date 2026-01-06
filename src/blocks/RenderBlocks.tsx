import React, { Fragment, Suspense } from 'react'
import dynamic from 'next/dynamic'

import type { Page } from '@/payload-types'

// Dynamic imports for code-splitting - blocks load on-demand
const ArchiveBlock = dynamic(() => import('@/blocks/ArchiveBlock/Component').then(m => ({ default: m.ArchiveBlock })))
const CallToActionBlock = dynamic(() => import('@/blocks/CallToAction/Component').then(m => ({ default: m.CallToActionBlock })))
const ContentBlock = dynamic(() => import('@/blocks/Content/Component').then(m => ({ default: m.ContentBlock })))
const FormBlock = dynamic(() => import('@/blocks/Form/Component').then(m => ({ default: m.FormBlock })))
const MediaBlock = dynamic(() => import('@/blocks/MediaBlock/Component').then(m => ({ default: m.MediaBlock })))
const StatsBlock = dynamic(() => import('@/blocks/Stats/Component').then(m => ({ default: m.StatsBlock })))

const blockComponents = {
  archive: ArchiveBlock,
  content: ContentBlock,
  cta: CallToActionBlock,
  formBlock: FormBlock,
  mediaBlock: MediaBlock,
  stats: StatsBlock,
}

export const RenderBlocks: React.FC<{
  blocks: Page['layout'][0][]
}> = (props) => {
  const { blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockType } = block

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            if (Block) {
              return (
                <div className="my-16" key={index}>
                  <Block {...(block as any)} disableInnerContainer />
                </div>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
