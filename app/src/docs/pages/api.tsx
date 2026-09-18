import type { DocPage } from '../components'
import { Code, Mono, Callout, DataTable, Endpoint } from '../components'

export const apiPages: DocPage[] = [
  {
    slug: 'api',
    title: 'API reference',
    tagline: 'Every endpoint the backend serves — 24 routes, grouped by area.',
    group: 'Reference',
    keywords: ['api', 'endpoints', 'rest', 'reference', 'routes', 'http'],
    body: (
      <>
        <p className="t-body">
          The backend is a FastAPI app. Base URL in dev:{' '}
          <Mono>http://localhost:8000</Mono>. All responses are JSON. Wallet-scoped
          routes need an EIP-191 signature (see <strong>Wallet &amp; auth</strong>);
          everything else is open.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Agents</h2>
        <Endpoint method="GET" path="/api/agents" />
        <p className="t-small mt-2">List the 16-agent catalogue. Optional <Mono>?category=Trading</Mono>.</p>
        <Endpoint method="GET" path="/api/agents/{'{agent_id}'}" />
        <p className="t-small mt-2">One agent's full record. 404 if unknown.</p>

        <h2 className="t-display mt-8 text-[20px]">Index &amp; basket</h2>
        <Endpoint method="GET" path="/api/index" />
        <p className="t-small mt-2">
          Index state: stock counts (193 universe / 192 verified), <Mono>$CLST</Mono>{' '}
          deployment flag, basket size. <Mono>clst_balance</Mono> is <Mono>null</Mono> until
          the token exists — honest null, never a fake zero.
        </p>
        <Endpoint method="GET" path="/api/index/payout-basket" />
        <p className="t-small mt-2">
          The 19-instrument payout basket with weights (sum 100), plus{' '}
          <Mono>universe_count: 193</Mono> stated explicitly so no client conflates them.
        </p>
        <Endpoint method="GET" path="/api/index/position" />
        <p className="t-small mt-2">
          Wallet-scoped index position — needs <Mono>?wallet=</Mono> + signature.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Market data</h2>
        <Endpoint method="GET" path="/api/market/quotes" />
        <p className="t-small mt-2">
          Batch quotes. <Mono>?symbols=NVDA,AAPL,…</Mono> (max 20). Returns price, day
          change (<Mono>regularMarketChangePercent</Mono>), volume.
        </p>
        <Endpoint method="GET" path="/api/market/quote/{'{symbol}'}" />
        <p className="t-small mt-2">Single-symbol quote.</p>
        <Endpoint method="GET" path="/api/market/movers" />
        <p className="t-small mt-2">
          Top gainers/losers across the universe. <Mono>?limit=8</Mono>. Ranked by real
          day change.
        </p>
        <Endpoint method="GET" path="/api/market/sectors" />
        <p className="t-small mt-2">Average performance per sector — 13 sectors, 192/193 symbols classified.</p>
        <Endpoint method="GET" path="/api/market/chart/{'{symbol}'}" />
        <p className="t-small mt-2">
          Price series. <Mono>?tf=1d|5d|1mo|3mo|6mo|1y|5y</Mono>.
        </p>
        <Endpoint method="GET" path="/api/market/agent-quotes" />
        <p className="t-small mt-2">
          Live quotes for agents with a real trading analogue (Relay→ETH, Pivot→BTC,
          Nexus→SOL, Oracle→BTC, Vault→ETH). No analogue → omitted, never faked.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Trading</h2>
        <Endpoint method="GET" path="/api/trade/status" />
        <p className="t-small mt-2">
          RPC health + context: block number, gas price (gwei), chain id. Also used by the
          Status view.
        </p>
        <Endpoint method="GET" path="/api/trade/quote" />
        <p className="t-small mt-2">
          Uniswap quote via backend RPC proxy (browsers get 403'd calling the public RPC
          directly). Params: <Mono>token</Mono>, <Mono>side=buy|sell</Mono>,{' '}
          <Mono>amount</Mono> (input wei), <Mono>via=WETH|USDG</Mono>. Returns path,
          expected output, gas estimate. No route → <Mono>{'{ok:false, error:"no route"}'}</Mono> at
          HTTP 200; RPC down → 502.
        </p>
        <Endpoint method="GET" path="/api/trade/token/{'{address}'}" />
        <p className="t-small mt-2">Token metadata (symbol, decimals) read from the chain.</p>

        <h2 className="t-display mt-8 text-[20px]">Portfolio &amp; runs</h2>
        <Endpoint method="GET" path="/api/portfolio" />
        <p className="t-small mt-2">
          Wallet activity summary. Needs <Mono>?wallet=</Mono> + <Mono>&amp;signature=</Mono>.
        </p>
        <Endpoint method="GET" path="/api/portfolio/history" />
        <p className="t-small mt-2">Run events for a wallet, newest first.</p>
        <Endpoint method="POST" path="/api/runs" />
        <p className="t-small mt-2">
          Dispatch a run: <Mono>{'{agent_id, wallet, detail, signature}'}</Mono>. Returns{' '}
          <Mono>status:"logged"</Mono>, <Mono>reward:0</Mono> — running is not a reward
          mechanic.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Memory</h2>
        <Endpoint method="POST" path="/api/memory/retain" />
        <p className="t-small mt-2"><Mono>{'{bank_id, content, agent_id?, title?, tags?, force?}'}</Mono> — store a note (dedupes unless <Mono>force</Mono>).</p>
        <Endpoint method="POST" path="/api/memory/recall" />
        <p className="t-small mt-2"><Mono>{'{bank_id, query, limit?}'}</Mono> — keyword × time-decay ranked notes.</p>
        <Endpoint method="POST" path="/api/memory/consolidate" />
        <p className="t-small mt-2"><Mono>{'{bank_id, topic, summary, source_ids?}'}</Mono> — store an LLM-written roll-up.</p>

        <h2 className="t-display mt-8 text-[20px]">Trading intelligence</h2>
        <Endpoint method="GET" path="/api/trading/status" />
        <p className="t-small mt-2">
          Live status of the OpenCatz screening engine (separate service, default{' '}
          <Mono>http://localhost:4671</Mono>). Unreachable → clean <Mono>503</Mono> with the
          start command — never a fabricated signal.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Distribution &amp; system</h2>
        <Endpoint method="GET" path="/api/distributions" />
        <p className="t-small mt-2">
          Payout cycle record from the public snapshot. Pre-launch:{' '}
          <Mono>live:false</Mono> + <Mono>reason</Mono>. 45s cache.
        </p>
        <Endpoint method="GET" path="/api/auth/challenge" />
        <p className="t-small mt-2">
          EIP-191 challenge for <Mono>?wallet=</Mono>. Single-use, 5-minute expiry.
        </p>
        <Endpoint method="GET" path="/health" />
        <p className="t-small mt-2"><Mono>{'{"status": "ok"}'}</Mono> — liveness probe.</p>

        <Callout kind="tip">
          <strong>Honest-error contract:</strong> business failures (no route, empty feed,
          unknown symbol) return HTTP 200 with an explicit <Mono>ok:false</Mono> /{' '}
          <Mono>live:false</Mono> body so the UI can render the reason. Only infrastructure
          failures (RPC down, Yahoo down, upstream 5xx) return 502. The API never returns a
          placeholder number.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Errors</h2>
        <DataTable
          head={['Status', 'Meaning', 'Body']}
          rows={[
            ['200', 'OK — may still carry ok:false / live:false for business states', 'JSON with reason'],
            ['401', 'Missing/invalid signature on a wallet-scoped route', '{"detail": "..."}'],
            ['404', 'Unknown agent / symbol / path', '{"detail": "..."}'],
            ['502', 'Upstream down (RPC, Yahoo) — never faked', '{"detail": "..."}'],
          ]}
        />
      </>
    ),
  },

  {
    slug: 'skill',
    title: 'Agent skill',
    tagline: 'Install Cluster as a skill so a coding agent can use it end to end.',
    group: 'Reference',
    keywords: ['skill', 'github', 'install', 'hermes', 'claude', 'cursor'],
    body: (
      <>
        <p className="t-body">
          The companion repo{' '}
          <a
            href="https://github.com/finchagentic/cluster-skill"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'underline' }}
          >
            finchagentic/cluster-skill
          </a>{' '}
          packages Cluster as an installable skill: what it is, how to call the API, and
          how to execute a swap on Robinhood Chain. Install it once and any skill-aware
          agent — Hermes, and anything reading the same format — can operate Cluster
          without you writing integration code.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Install</h2>
        <Code
          label="shell"
          code={`hermes skills install https://raw.githubusercontent.com/finchagentic/cluster-skill/main/SKILL.md --name cluster --yes`}
        />
        <p className="t-body mt-3">
          Verify it landed:
        </p>
        <Code label="shell" code={`hermes skills list | grep cluster`} />

        <h2 className="t-display mt-8 text-[20px]">What's inside</h2>
        <DataTable
          head={['File', 'Content']}
          rows={[
            [<Mono key="1">SKILL.md</Mono>, 'Triggers, the mental model, quickstart, and the API/swap pointers'],
            [<Mono key="2">references/api.md</Mono>, 'Endpoint-by-endpoint reference for the backend'],
            [<Mono key="3">references/swap.md</Mono>, 'In-app swap execution: router, quoter, multicall, slippage'],
            [<Mono key="4">README.md</Mono>, 'Human-facing repo readme'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">What the agent can do with it</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>Query the catalogue and dispatch runs (with a wallet).</li>
          <li>Read market data and basket composition.</li>
          <li>Quote and execute swaps against the live contracts on chain 4663.</li>
          <li>Retain/recall memory notes for a wallet.</li>
        </ul>

        <Callout kind="note">
          The skill is documentation + conventions, not a package — it teaches an agent to
          use the HTTP API and the on-chain contracts that already exist. No extra service
          to run.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">For other agent runtimes</h2>
        <p className="t-body mt-3">
          If your agent doesn't read this skill format, use the{' '}
          <strong>MCP server</strong> instead — it exposes the same capabilities as ten
          protocol-level tools that Claude Desktop, Cursor and friends already understand.
        </p>
      </>
    ),
  },
]
