// RH Chain native crypto assets (bukan tokenized stocks).
// Addresses verified dari finchagentic robinhoodStocks.ts (ROBINHOOD_TRENDING, on-chain checked)
// + WETH/USDG dari docs. PONS pool verified dari ponsfees/CLAUDE.md (Blockscout-sourced).
// DexScreener resolves deepest live pool per token automatically (token page).
//
// TRADEABILITY (verified on-chain via QuoterV2): only tokens whose pools live on the
// CANONICAL Uniswap V3 factory are swap-able through SwapRouter02. Pons-launchpad
// tokens deploy pools on their OWN factory — those need the V4 Universal Router +
// Permit2 (finchagentic pattern, TODO). Until then `swapable: false` tokens show
// chart + price but the swap button routes users to the pons launchpad instead.
export type CryptoAsset = { s: string; n: string; a: `0x${string}`; p: `0x${string}` | null; swapable?: boolean }

export const CRYPTO_ASSETS: CryptoAsset[] = [
  { s: 'PONS',        n: 'Pons',              a: '0x39dBED3a2bd333467115dE45665cC57F813C4571', p: '0x10cc6bd38112cac182db90b6a71d8bb5939526ba', swapable: true },
  { s: 'WETH',        n: 'Wrapped ETH',       a: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73', p: null, swapable: true },
  { s: 'USDG',        n: 'Global Dollar',     a: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', p: null, swapable: true },
  { s: 'FINCH',       n: 'Finch Agentic',     a: '0x879f29204a5ff842c66f0f65e0f2e422073acce7', p: null , swapable: false },
  { s: 'SWOGE',       n: 'Swole Doge',        a: '0xdb87393727b666c43f5aecb03d8b419ba54d9b03', p: null , swapable: false },
  { s: 'RHAGENT',     n: 'RHAgent',           a: '0x894fac757250f8e02180e1856957274d84ac4ba3', p: null , swapable: false },
  { s: 'NOXA',        n: 'Noxa',              a: '0x39e0d9057bd9039cd14590f54de20b9d3457c56e', p: null , swapable: false },
  { s: 'PONSTR',      n: 'PON Strategy',      a: '0x4a76d884bb9cbbf2138fbe47e99584eb5168dde2', p: null , swapable: false },
  { s: 'ARENA',       n: 'Robin Arena',       a: '0x14dad3f05f7e25ee79b780119db96baa6b30e7c0', p: null , swapable: false },
  { s: 'IF',          n: 'What If',           a: '0x232cdfc415d10b673845d83dc02ba2eabe7e30d1', p: null, swapable: false },
  { s: 'BUTTERCOIN',  n: 'BUTTERCOIN',        a: '0xcdd50d73b45085d71cb05e2ca238d12c3bd7bebd', p: null , swapable: false },
  { s: 'WALLET',      n: 'Robinhood Wallet',  a: '0x0339f5459fc690ac85f1782e15782a151b4a9e1b', p: null , swapable: false },
  { s: 'CLIPPY',      n: 'Clippy',            a: '0x85856f025bf13b8fd2aae2f6da458318744f1e18', p: null, swapable: true },
  { s: 'KARMA',       n: 'Karma by Virtuals', a: '0xb47f4702deb124cb4eb6286be83c9d84277c6239', p: null, swapable: true },
  { s: 'SQUEEZE',     n: 'The Great Squeeze', a: '0xf444f3c77c77a33f7c8d8fcab8a1e88afb843da5', p: null , swapable: false },
]
