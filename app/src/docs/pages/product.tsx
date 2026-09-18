import type { DocPage } from '../components'
import { Code, Mono, Callout, DataTable } from '../components'

export const productPages: DocPage[] = [
  {
    slug: 'market',
    title: 'Market data',
    tagline: 'Live quotes, movers, sector heat and charts — real Yahoo data, never fabricated.',
    group: 'The product',
    keywords: ['market', 'quotes', 'movers', 'sectors', 'chart', 'yahoo', 'sparkline'],
    body: (
      <>
        <p className="t-body">
          The Market view is a real market-data surface: a ticker of the basket, top
          movers, sector heat across the 193-instrument universe, and per-symbol charts.
          Everything comes from Yahoo Finance through the backend proxy — with an honest
          failure mode instead of fake numbers.
        </p>

        <h2 className="t-display mt-8 text-[20px]">What's on the screen</h2>
        <DataTable
          head={['Panel', 'What it shows', 'Endpoint']}
          rows={[
            ['Ticker', 'Basket symbols with live price + day change', <Mono key="1">/api/market/quotes</Mono>],
            ['Movers', 'Top gainers / losers across the universe, ranked by real day change', <Mono key="2">/api/market/movers</Mono>],
            ['Sector heat', 'Average performance per sector (11 sectors, 192/193 covered)', <Mono key="3">/api/market/sectors</Mono>],
            ['Chart', 'Per-symbol price series, switchable timeframes', <Mono key="4">/api/market/chart/&#123;symbol&#125;</Mono>],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">How quotes are fetched</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>
            <strong>Batched spark:</strong> up to 20 symbols per Yahoo spark call, 1-month
            daily closes, 60-second cache.
          </li>
          <li>
            <strong>Per-symbol chart fallback:</strong> if the batch fails, the API retries
            each symbol individually.
          </li>
          <li>
            <strong>yfinance last resort:</strong> a third path for stubborn symbols.
          </li>
          <li>
            <strong>Honest failure:</strong> if all three fail, the endpoint returns 502 and
            the UI renders "market data unavailable". It never invents a price.
          </li>
        </ol>

        <Callout kind="warn">
          <strong>Self-hoster note:</strong> Yahoo throttles the long desktop User-Agent
          string from datacenter IPs (HTTP 429). The short <Mono>Mozilla/5.0</Mono> UA is
          accepted consistently — the backend already uses it. If quotes still fail, see{' '}
          <strong>Troubleshooting</strong>.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Day change, done right</h2>
        <p className="t-body mt-3">
          Movers rank by <Mono>regularMarketChangePercent</Mono> — the true
          day-over-day change. An earlier build used{' '}
          <Mono>chartPreviousClose</Mono> from a 1-month range, which is the close{' '}
          <em>a month ago</em>, producing a fake +127% for MRNA. That bug is fixed and the
          correct field is used everywhere day change appears.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Try it</h2>
        <Code
          label="shell"
          code={`curl "http://localhost:8000/api/market/quotes?symbols=NVDA,AAPL,MSFT"
curl "http://localhost:8000/api/market/movers?limit=8"
curl http://localhost:8000/api/market/sectors
curl "http://localhost:8000/api/market/chart/NVDA?tf=1mo"`}
        />
        <p className="t-body mt-3">
          Timeframes supported: <Mono>1d</Mono>, <Mono>5d</Mono>, <Mono>1mo</Mono>,{' '}
          <Mono>3mo</Mono>, <Mono>6mo</Mono>, <Mono>1y</Mono>, <Mono>5y</Mono>.
        </p>
      </>
    ),
  },

  {
    slug: 'trading',
    title: 'Trading in the app',
    tagline: 'Buy and sell any of the 193 stocks without leaving the app — quotes, swaps, receipts.',
    group: 'The product',
    keywords: ['trade', 'swap', 'uniswap', 'buy', 'sell', 'quoter', 'router', 'eth', 'usdg'],
    body: (
      <>
        <p className="t-body">
          The Trade view is a full in-app swap ticket on Robinhood Chain. You pick a token
          from the 193-instrument universe, choose buy or sell, get a live quote, and
          execute — the swap happens <strong>inside the app</strong>. No redirect to an
          external Uniswap page.
        </p>

        <h2 className="t-display mt-8 text-[20px]">The flow</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li><strong>Pick a token</strong> — search the universe, or pick from the basket.</li>
          <li><strong>Choose side</strong> — Buy (ETH or USDG → stock) or Sell (stock → ETH).</li>
          <li><strong>Enter an amount</strong> — the ticket shows the live quote as you type.</li>
          <li><strong>Get quote</strong> — works with no wallet connected; it's a read-only call.</li>
          <li><strong>Execute</strong> — this is where a wallet is required. Sign the transaction; the wallet stays in your browser.</li>
          <li><strong>Receipt</strong> — the app polls for the receipt and shows the confirmed swap.</li>
        </ol>

        <Callout kind="note">
          <strong>Quoting is open, executing is gated.</strong> Anyone can quote — the
          backend proxies the QuoterV2 call. Only the execute button requires a connected
          wallet, because only then can a transaction be signed and broadcast.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Why the quote goes through the backend</h2>
        <p className="t-body mt-3">
          Browsers can't always <Mono>eth_call</Mono> the public Robinhood RPC directly —
          cross-origin requests get 403'd. So the backend proxies the quote over raw
          JSON-RPC (no web3 dependency) and hands the frontend a ready-to-sign path. Same
          finding, same fix, as Chronoa's quote endpoint.
        </p>

        <h2 className="t-display mt-8 text-[20px]">The contracts</h2>
        <DataTable
          head={['Contract', 'Address']}
          rows={[
            ['SwapRouter02', <Mono key="1">0xcaf681a66d020601342297493863e78c959e5cb2</Mono>],
            ['QuoterV2', <Mono key="2">0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7</Mono>],
            ['WETH', <Mono key="3">0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73</Mono>],
            ['USDG', <Mono key="4">0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168</Mono>],
          ]}
        />
        <p className="t-body mt-3">
          Same verified contract set Chronoa and Kumo use. The app supports ETH and USDG as
          the input currency, with multi-hop route candidates (100/500/3000 fee tiers)
          ranked by output.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Execution details (for the curious)</h2>
        <DataTable
          head={['Step', 'Buy (ETH → stock)', 'Sell (stock → ETH)']}
          rows={[
            ['Call', 'multicall([exactInput, refundETH])', 'multicall([exactInput, unwrapWETH9])'],
            ['Value', 'msg.value carries the ETH', 'no value — token input'],
            ['Approval', 'not needed', 'approve(ROUTER) once, first sell only'],
            ['Recipient', 'your wallet', 'router, then unwrapped to your wallet'],
            ['Slippage', '1% floor (minOut = 99% of quote)', 'same'],
          ]}
        />

        <Callout kind="tip">
          <strong>Why not wrap ETH first?</strong> Calling <Mono>wrapETH</Mono> then{' '}
          <Mono>exactInput</Mono> reverts with STF — the router pays the first WETH hop
          straight from <Mono>msg.value</Mono>. Sending value with the swap is the working
          path, and it's what the app does.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Try it over the API</h2>
        <Code
          label="shell"
          code={`# chain + gas context
curl http://localhost:8000/api/trade/status

# quote: 0.01 ETH -> NVDA (amount in wei of the input token)
curl "http://localhost:8000/api/trade/quote?token=0x117cc2133c37B0a3B0Ed7e2C8b0B5F2F1d0e5C3a&side=buy&amount=10000000000000000&via=WETH"

# token metadata (symbol + decimals) for any address
curl http://localhost:8000/api/trade/token/0x...`}
        />
        <p className="t-body mt-3">
          The quote response carries the full path, expected output, and gas estimate —
          everything the client needs to build the transaction. Honest failure: no route
          returns <Mono>{'{"ok": false, "error": "no route"}'}</Mono> with HTTP 200 so the
          UI can render it; RPC down returns 502.
        </p>
      </>
    ),
  },

  {
    slug: 'portfolio',
    title: 'Portfolio & history',
    tagline: "Your wallet's activity across agents — wallet-scoped, signature-verified.",
    group: 'The product',
    keywords: ['portfolio', 'history', 'activity', 'runs', 'wallet'],
    body: (
      <>
        <p className="t-body">
          Portfolio and History are the two wallet-scoped views. They show{' '}
          <strong>activity</strong> — which agent capabilities your wallet has exercised —
          not a token balance (there is no token yet) and not a reward total (running
          doesn't pay).
        </p>

        <h2 className="t-display mt-8 text-[20px]">What each view shows</h2>
        <DataTable
          head={['View', 'Shows', 'Endpoint']}
          rows={[
            ['Portfolio', 'How many distinct agents you have tried + the activity feed', <Mono key="1">/api/portfolio</Mono>],
            ['History', 'Every run event for your wallet, newest first', <Mono key="2">/api/portfolio/history</Mono>],
          ]}
        />
        <p className="t-body mt-3">
          Both are empty without a connected wallet — and they say so honestly rather than
          showing placeholder data. Connect, sign the challenge, and your activity loads.
        </p>

        <h2 className="t-display mt-8 text-[20px]">What a run event is</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>agent_id / agent_name</strong> — which capability you used.</li>
          <li><strong>detail</strong> — the brief you wrote.</li>
          <li><strong>status</strong> — always <Mono>"logged"</Mono>: the interaction happened and was recorded.</li>
          <li><strong>reward</strong> — always <Mono>0</Mono>. Not a reward mechanic.</li>
          <li><strong>created_at</strong> — when it happened.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">API access</h2>
        <Code
          label="shell"
          code={`# 1. get a challenge for your wallet
curl "http://localhost:8000/api/auth/challenge?wallet=0xYourWallet"

# 2. sign the returned message with personal_sign (MetaMask, wagmi, etc.)

# 3. read your portfolio with the signature
curl "http://localhost:8000/api/portfolio?wallet=0xYourWallet&signature=0xSig"

# history
curl "http://localhost:8000/api/portfolio/history?wallet=0xYourWallet&signature=0xSig"`}
        />
        <p className="t-body mt-3">
          Challenges are single-use and expire after 5 minutes. The backend recovers your
          address from the signature and compares — a caller who can't prove ownership
          gets a 401, never someone else's data.
        </p>
      </>
    ),
  },

  {
    slug: 'distribution',
    title: 'Distribution tab',
    tagline: 'The public record of every payout cycle — time, recipients, USD, assets, tx.',
    group: 'The product',
    keywords: ['distribution', 'payout', 'cycle', 'feed', 'holders', 'record'],
    body: (
      <>
        <p className="t-body">
          The Distribution tab is the <strong>public record</strong> of payouts: every
          cycle the keeper bot has run, with timestamps, recipient counts, USD totals,
          asset legs, and transaction hashes. It reads a public JSON snapshot the bot
          publishes — this backend never touches the chain for this data.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Pre-launch state (right now)</h2>
        <p className="t-body mt-3">
          <Mono>$CLST</Mono> isn't deployed, so no fees have been collected and no cycle
          has run. The tab shows exactly that — a written explanation, not a fake table:
        </p>
        <Code
          label="response"
          code={`{
  "live": false,
  "reason": "feed_not_configured",
  "detail": "$CLST has not launched yet, so no fees have been collected and no distribution cycle has run...",
  "totals": { "cycles": 0, "distributed_usd": 0.0, "recipients": 0 },
  "cycles": []
}`}
        />

        <h2 className="t-display mt-8 text-[20px]">When it goes live</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>The keeper bot completes its first cycle and publishes <Mono>latest.json</Mono>.</li>
          <li>You set <Mono>AGENTINDEX_FEED_URL</Mono> to the raw URL of that snapshot.</li>
          <li><Mono>/api/distributions</Mono> flips to <Mono>live: true</Mono> and serves real cycles (45s cache).</li>
          <li>The tab renders the full record — no code change needed.</li>
        </ol>

        <h2 className="t-display mt-8 text-[20px]">Feed shape</h2>
        <Code
          label="latest.json"
          code={`{
  "updatedAt": "2026-09-16T12:00:00Z",
  "mode": "live",
  "totals": { "cycles": 12, "distributedUsd": 4821.55 },
  "payrollCount": 214,
  "distributionHistory": [
    {
      "at": "2026-09-16T11:59:00Z",
      "cycleIndex": 12,
      "usd": 402.10,
      "transfers": 214,
      "recipientsCount": 214,
      "assets": [{ "symbol": "NVDA", "amount": 0.31 }]
    }
  ]
}`}
        />
        <p className="t-body mt-3">
          The backend normalizes this into the app's shape (sorted newest-first, capped at
          60 cycles). If the feed URL is set but unreachable, the endpoint returns a clean
          502 — never stale-as-fresh data.
        </p>

        <h2 className="t-display mt-8 text-[20px]">How to verify a payout yourself</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>Open a cycle in the tab and copy its transaction hash.</li>
          <li>Open the hash on the Robinhood Chain explorer.</li>
          <li>Check the token transfers — the receiving addresses should be holders, the amounts pro-rata to holdings.</li>
          <li>Cross-check the cycle's USD total against the snapshot and the treasury's inbound fees.</li>
        </ol>
        <Callout kind="note">
          No smart contract is involved in distributions — the bot pushes transfers
          directly. That means verification is plain on-chain reading: no contract logic
          to trust, no ABI to decode.
        </Callout>
      </>
    ),
  },

  {
    slug: 'wallet-auth',
    title: 'Wallet & auth',
    tagline: 'Reown AppKit for connect, EIP-191 signatures for every wallet-scoped request.',
    group: 'The product',
    keywords: ['wallet', 'auth', 'reown', 'walletconnect', 'signature', 'eip-191', 'challenge'],
    body: (
      <>
        <p className="t-body">
          Cluster uses <strong>Reown AppKit</strong> (formerly WalletConnect) for wallet
          connect — QR, 540+ injected wallets (MetaMask, Trust, Binance Wallet, …), all on
          Robinhood Chain (4663). No email, no socials, no embedded accounts: a real wallet,
          or nothing.
        </p>

        <h2 className="t-display mt-8 text-[20px]">When a wallet is needed</h2>
        <DataTable
          head={['Action', 'Wallet needed?']}
          rows={[
            ['Browsing agents, basket, market, docs', 'No — everything is open'],
            ['Getting a swap quote', 'No — read-only'],
            ['Dispatching an agent (run)', 'Yes — the run logs against your address'],
            ['Reading your portfolio / history', 'Yes — it is your data'],
            ['Executing a trade', 'Yes — only you can sign the transaction'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">The auth flow (EIP-191)</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>
            <strong>Challenge</strong> — the client asks for a message:{' '}
            <Mono>GET /api/auth/challenge?wallet=0x…</Mono>
          </li>
          <li>
            <strong>Sign</strong> — the wallet signs it with <Mono>personal_sign</Mono>.
            The message says "This request will not cost any gas."
          </li>
          <li>
            <strong>Verify</strong> — the client sends <Mono>{'{wallet, signature}'}</Mono>{' '}
            with the request; the backend recovers the signer and compares, case-insensitively.
          </li>
          <li>
            <strong>Single-use</strong> — the challenge burns on use and expires after 5
            minutes, so a captured signature can't be replayed.
          </li>
        </ol>
        <p className="t-body mt-3">
          This closes a real gap: without it,{' '}
          <Mono>POST /api/runs {'{"wallet": "<anyone>"}'}</Mono> worked with zero proof of
          ownership — anyone could write fake history to your address or read your
          portfolio. Every wallet-scoped route now calls <Mono>require_wallet_auth</Mono>{' '}
          first, and the code fails closed on malformed input.
        </p>

        <Callout kind="warn">
          <Mono>AGENTINDEX_DEV_AUTH_BYPASS=1</Mono> exists for local curl testing only. It
          skips signature checks, is loudly logged, and must never be set in a real
          deployment.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Config</h2>
        <p className="t-body mt-3">
          Lives in <Mono>app/src/lib/web3.ts</Mono>. The Reown <Mono>projectId</Mono> is a
          public browser key (safe to ship in the bundle) shared with our other Robinhood
          Chain deployments — get your own free at{' '}
          <a href="https://dashboard.reown.com" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            dashboard.reown.com
          </a>{' '}
          if you fork this for a different project.
        </p>
        <Callout kind="tip">
          The wallet connection is app-wide: once connected, it stays connected as you
          move between Market, Agents, Portfolio and Trade — no re-connecting per view.
        </Callout>
      </>
    ),
  },
]
