import React from 'react'
import dynamic from 'next/dynamic'

import type { Page } from '@/payload-types'

// Dynamic imports for code-splitting - heroes load on-demand
const HighImpactHero = dynamic(() => import('@/heros/HighImpact').then(m => ({ default: m.HighImpactHero })))
const LowImpactHero = dynamic(() => import('@/heros/LowImpact').then(m => ({ default: m.LowImpactHero })))
const MediumImpactHero = dynamic(() => import('@/heros/MediumImpact').then(m => ({ default: m.MediumImpactHero })))

const heroes = {
  highImpact: HighImpactHero,
  lowImpact: LowImpactHero,
  mediumImpact: MediumImpactHero,
}

export const RenderHero: React.FC<Page['hero']> = (props) => {
  const { type } = props || {}

  if (!type || type === 'none') return null

  const HeroToRender = heroes[type]

  if (!HeroToRender) return null

  return <HeroToRender {...props} />
}
