"use client"
/**
 * Reown AppKit (WalletConnect) wallet connect for Cluster.
 * Same provider family / project ID as our other Robinhood Chain
 * deployments (darkbloom, ponsbloom) — see
 * skill:web3/evm-wallet-auth/references/reown-appkit-modal.md for the
 * proven integration recipe this file follows.
 *
 * projectId is Reown's PUBLIC browser key — safe to ship in the bundle.
 */
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'wagmi'
import type { AppKitNetwork } from '@reown/appkit/networks'

export const REOWN_PROJECT_ID = '7ed02309417cc413eac4b929bf764f1f'

// Robinhood Chain (4663) — where $CLST settles.
export const robinhoodChain = {
  id: 4663,
  caipNetworkId: 'eip155:4663',
  chainNamespace: 'eip155',
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.mainnet.chain.robinhood.com'] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://explorer.mainnet.chain.robinhood.com' } },
} as const satisfies AppKitNetwork

export const NETWORKS: [AppKitNetwork, ...AppKitNetwork[]] = [robinhoodChain, mainnet] as unknown as [
  AppKitNetwork,
  ...AppKitNetwork[],
]

export const wagmiAdapter = new WagmiAdapter({
  networks: NETWORKS,
  projectId: REOWN_PROJECT_ID,
  ssr: false,
  transports: { [robinhoodChain.id]: http(robinhoodChain.rpcUrls.default.http[0]) },
})

// Single source of truth — exported for both AppKit and any wagmi read
// hooks (useBalance/useReadContract) so they share the connected account.
export const wagmiConfig = wagmiAdapter.wagmiConfig

let initialized = false

export function initAppKit() {
  if (initialized || typeof window === 'undefined') return
  createAppKit({
    adapters: [wagmiAdapter],
    networks: NETWORKS,
    projectId: REOWN_PROJECT_ID,
    defaultNetwork: robinhoodChain,
    themeMode: 'light',
    themeVariables: {
      // Cluster warm-grey palette — matches src/index.css
      '--w3m-accent': '#171717',
      '--w3m-color-mix': '#ffffff',
      '--w3m-color-mix-strength': 8,
      '--w3m-border-radius-master': '6px',
      '--w3m-font-family': "'Inter', -apple-system, sans-serif",
    },
    features: { analytics: false, swaps: false, onramp: false, email: false, socials: false },
    metadata: {
      name: 'Cluster',
      description: 'Every agent pays its holders.',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://cluster.local',
      icons: [],
    },
  })
  initialized = true
}
