import type { DocPage } from '../components'
import { startPages } from './start'
import { agentPages } from './agents'
import { productPages } from './product'
import { platformPages } from './platform'
import { apiPages } from './api'
import { extraPages } from './extras'

export type { DocPage }

export interface DocGroup {
  name: string
  blurb: string
}

/**
 * Order matters — this is the sidebar order and the prev/next chain.
 * Groups mirror the reference docs we benchmarked (Finch docs, Ralpharium):
 * start here → the product → the platform → reference.
 */
export const DOC_GROUPS: DocGroup[] = [
  { name: 'Getting started', blurb: 'What this is and how to run it' },
  { name: 'The product', blurb: 'Agents, basket, market, trading, wallet' },
  { name: 'Platform', blurb: 'MCP, memory, self-hosting, config, fixes' },
  { name: 'Reference', blurb: 'API surface and the agent skill' },
]

export const DOC_PAGES: DocPage[] = [
  ...startPages,
  ...agentPages,
  ...productPages,
  ...platformPages,
  ...apiPages,
  ...extraPages,
]
