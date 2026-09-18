import type { DocPage } from '../components'
import { Code, Mono, Callout, DataTable } from '../components'

export const startPages: DocPage[] = [
  {
    slug: 'overview',
    title: 'What is Cluster',
    tagline: 'A self-hostable index of AI agents. Every agent pays its holders.',
    group: 'Getting started',
    keywords: ['intro', 'about', 'clst', 'what', 'index'],
    body: (
      <>
        <p className="t-body">
          Cluster is an <strong>index of AI agents</strong> — sixteen agent capabilities
          spanning finance, research, trading, memory, analysis and crypto. Each agent
          performs real work (a swap, a report, a bookkeeping task) and charges a fee for
          it. A cut of every fee flows back to the people holding <Mono>$CLST</Mono>, the
          index token.
        </p>
        <p className="t-body mt-4">
          The mental model: an ETF, but instead of tracking a sector of the stock market,
          it tracks a basket of <em>agent activity</em>. Holders aren't paid for running
          agents — they're paid for <strong>holding</strong>. Agents are the revenue
          engine; holders are the shareholders.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            { k: '16', v: 'agent capabilities', d: 'Trading, Research, Finance, Analysis, Memory, Crypto' },
            { k: '193', v: 'tokenized stocks in the universe', d: '192 independently RPC-verified on Robinhood Chain' },
            { k: '19', v: 'instruments in the payout basket', d: 'What holders are actually paid in — curated, weighted' },
            { k: '1', v: 'chain', d: 'Robinhood Chain (4663) — where everything settles' },
          ].map((s) => (
            <div
              key={s.v}
              className="rounded-xl border px-4 py-3.5"
              style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
            >
              <div className="t-display text-[22px]">{s.k}</div>
              <div className="t-small mt-0.5 font-medium">{s.v}</div>
              <div className="t-small mt-1" style={{ color: 'var(--ink-soft)' }}>
                {s.d}
              </div>
            </div>
          ))}
        </div>

        <h2 className="t-display mt-10 text-[20px]">The loop</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>A user (or an AI agent over MCP) commissions an agent — a swap, a report, a task.</li>
          <li>The agent settles the work and takes its fee.</li>
          <li>Fees accumulate in the index treasury on Robinhood Chain.</li>
          <li>A keeper bot swaps the fees into the <strong>payout basket</strong> (19 instruments).</li>
          <li>The bot pushes a pro-rata slice of each instrument to every eligible <Mono>$CLST</Mono> holder, one batched transaction per cycle.</li>
          <li>The bot publishes a public JSON snapshot; the app's Distribution tab reads it.</li>
        </ol>

        <Callout kind="note">
          <strong>Pre-launch right now.</strong> <Mono>$CLST</Mono> has not been deployed
          yet — no contract address exists. Everything else you see (the agent catalogue,
          the 193-instrument universe, live market data, the in-app trader) is real and
          running. The token shows an honest <em>Cooming soon</em> state everywhere, and
          flips live the moment <Mono>AGENTINDEX_CLST_TOKEN_ADDRESS</Mono> is set — zero
          code change.
        </Callout>

        <h2 className="t-display mt-10 text-[20px]">Four parts, one repo</h2>
        <DataTable
          head={['Part', 'What it is', 'Where']}
          rows={[
            ['Frontend', 'React + Vite site and app — every view you see', <Mono key="1">app/</Mono>],
            ['Backend', 'FastAPI — catalogue, runs, portfolio, market data, distributions, memory', <Mono key="2">server/</Mono>],
            ['MCP server', 'Lets any AI agent (Claude, Cursor, Hermes) drive Cluster', <Mono key="3">mcp/</Mono>],
            ['Docs', 'This manual — operator + user', <Mono key="4">/docs</Mono>],
          ]}
        />

        <h2 className="t-display mt-10 text-[20px]">What makes it different</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>No smart contract to trust.</strong> Distribution follows the same
            no-contract pattern as Stock Divvy / Kumo / SPX500: a keeper bot holds the
            treasury, buys the basket, and pushes payouts. You verify it on-chain, not in
            a contract you can't read.
          </li>
          <li>
            <strong>Honest by construction.</strong> No fabricated prices, balances, or
            rewards — anywhere. When data doesn't exist yet, the API says so and the UI
            renders the empty state verbatim.
          </li>
          <li>
            <strong>Open without a wallet.</strong> Browse everything — agents, the
            basket, market data, this manual — with no wallet. A wallet is needed only to
            dispatch an agent or trade.
          </li>
          <li>
            <strong>Self-hostable.</strong> Three parts, run in order, SQLite by default —
            works on a small VPS with zero extra services.
          </li>
        </ul>

        <h2 className="t-display mt-10 text-[20px]">Where to go next</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Quickstart</strong> — run the whole stack in five minutes.</li>
          <li><strong>How it works</strong> — the full mechanism, end to end.</li>
          <li><strong>The agents</strong> — all sixteen capabilities in a table.</li>
          <li><strong>Trading</strong> — how to buy and sell in-app.</li>
          <li><strong>API reference</strong> — every endpoint, grouped by area.</li>
        </ul>
      </>
    ),
  },

  {
    slug: 'quickstart',
    title: 'Quickstart',
    tagline: 'Run the whole stack — backend, frontend, MCP — in about five minutes.',
    group: 'Getting started',
    keywords: ['install', 'run', 'setup', 'self-host', 'start'],
    body: (
      <>
        <p className="t-body">
          Three parts, run in order. Everything defaults to zero-config: SQLite memory,
          public RPC, no API keys required to boot.
        </p>

        <h2 className="t-display mt-8 text-[20px]">1. Backend (FastAPI)</h2>
        <Code
          label="shell"
          code={`cd server
cp .env.example .env      # defaults to MEMORY_BACKEND=sqlite — zero deps
./run.sh                  # serves http://localhost:8000`}
        />
        <p className="t-body mt-3">
          Verify it's alive:
        </p>
        <Code label="shell" code={`curl http://localhost:8000/health`} />

        <h2 className="t-display mt-8 text-[20px]">2. Frontend (React + Vite)</h2>
        <Code
          label="shell"
          code={`cd app
npm install
npm run dev               # serves http://localhost:5173`}
        />
        <p className="t-body mt-3">
          In dev, Vite proxies <Mono>/api</Mono> to <Mono>http://localhost:8000</Mono>{' '}
          automatically (see <Mono>vite.config.ts</Mono>). In production, point the build at
          your backend with <Mono>VITE_API_BASE</Mono>.
        </p>

        <h2 className="t-display mt-8 text-[20px]">3. MCP server (optional)</h2>
        <p className="t-body">
          Only needed if you want an AI agent — Claude Desktop, Cursor, Hermes — to drive
          Cluster over the Model Context Protocol.
        </p>
        <Code label="shell" code={`cd mcp\n./run.sh                  # creates .venv on first run, then serves stdio`} />

        <h2 className="t-display mt-8 text-[20px]">Then open the app</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><Mono>http://localhost:5173</Mono> — the landing page, with this manual inline.</li>
          <li><Mono>http://localhost:5173/docs</Mono> — this full docs site.</li>
          <li>Click <strong>Open app</strong> for the operator views: Portfolio, Index, Market, Agents, Distribution, Trade, History, Status.</li>
        </ul>

        <Callout kind="tip">
          No wallet is needed to browse any of it. Connect one only when you want to
          dispatch an agent (the run logs against your address) or trade.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">What you should see</h2>
        <DataTable
          head={['Check', 'Expected']}
          rows={[
            [<Mono key="1">/health</Mono>, '{"status": "ok"}'],
            [<Mono key="2">/api/agents</Mono>, 'count: 16 — the full catalogue'],
            [<Mono key="3">/api/index</Mono>, 'stock_count: 193, verified_on_chain_count: 192, clst_deployed: false'],
            [<Mono key="4">/api/trade/status</Mono>, 'rpc_ok: true, current block, gas price in gwei'],
            [<Mono key="5">/api/market/movers</Mono>, 'live gainers/losers from Yahoo — real quotes only'],
          ]}
        />

        <Callout kind="warn">
          If <Mono>/api/market/*</Mono> returns 502, your host is being throttled by
          Yahoo. The API never fabricates a price in that case — see{' '}
          <strong>Troubleshooting</strong> for the fix.
        </Callout>
      </>
    ),
  },

  {
    slug: 'how-it-works',
    title: 'How it works',
    tagline: 'The complete mechanism: agents → fees → keeper bot → holders.',
    group: 'Getting started',
    keywords: ['mechanism', 'fees', 'treasury', 'keeper', 'payout', 'revenue'],
    body: (
      <>
        <p className="t-body">
          Cluster has two halves that connect through one loop: an{' '}
          <strong>agent marketplace</strong> that earns fees, and a{' '}
          <strong>distribution engine</strong> that pays those fees to <Mono>$CLST</Mono>{' '}
          holders. This page is the full walk-through.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Half 1 — the agents earn</h2>
        <p className="t-body mt-3">
          Sixteen agents (Relay, Scout, Ledger, Argus, Pivot, Prism, Memoria, Sifter,
          Remit, Nexus, Echo, Census, Vault, Quill, Oracle, Margin) each do a specific job
          and charge a fee when they do it. The fee triggers vary by agent:
        </p>
        <DataTable
          head={['Trigger', 'Meaning', 'Example agents']}
          rows={[
            ['Per swap', 'A trade executes through the agent', 'Relay, Pivot'],
            ['Per report', 'A research deliverable is produced', 'Scout, Sifter, Quill'],
            ['Per task', 'A unit of work completes', 'Ledger, Memoria, Remit, Nexus, Vault, Margin'],
            ['Per query', 'A question is answered / data served', 'Argus, Prism, Echo, Census, Oracle'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Half 2 — the fees flow to holders</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>
            <strong>Fees settle in the treasury.</strong> Agent fees accumulate at the
            treasury address on Robinhood Chain.
          </li>
          <li>
            <strong>The keeper bot buys the basket.</strong> On each cycle it swaps the
            accumulated fees into the 19 instruments of the payout basket on Uniswap.
          </li>
          <li>
            <strong>Pro-rata push.</strong> The bot sends every eligible holder their
            proportional slice of each instrument — one batched transaction per cycle.
          </li>
          <li>
            <strong>Public snapshot.</strong> The bot publishes <Mono>latest.json</Mono>{' '}
            every ~60 seconds: cycle history, USD totals, recipient counts, asset legs.
          </li>
          <li>
            <strong>The app reads the snapshot.</strong> The backend serves it at{' '}
            <Mono>/api/distributions</Mono> (via <Mono>AGENTINDEX_FEED_URL</Mono>) and the
            Distribution tab renders every cycle.
          </li>
        </ol>

        <Callout kind="note">
          <strong>No smart contract in the middle.</strong> This is the same pattern as
          Stock Divvy / Kumo / SPX500: the bot holds the treasury and pushes payouts
          itself. There's no contract to audit for a distribution bug — you verify the
          bot's on-chain transactions directly (see <strong>Verify a payout</strong>).
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Why holding pays, not running</h2>
        <p className="t-body mt-3">
          The revenue model is deliberately simple: <strong>holding</strong> <Mono>$CLST</Mono>{' '}
          gives you a proportional claim on the basket, and the basket grows as agents earn
          fees. Running an agent is just how you <em>use</em> the product — it logs activity
          against your wallet (useful for history and memory), but it is not a reward
          mechanic. This matters: an earlier build paid a random "reward" per run, which was
          wrong twice over — <Mono>$CLST</Mono> isn't deployed yet so nothing could settle,
          and the real model is hold-to-earn. The run endpoint now always logs{' '}
          <Mono>reward: 0</Mono>, and the code says so in its own docstring.
        </p>

        <h2 className="t-display mt-8 text-[20px]">What you can verify yourself</h2>
        <DataTable
          head={['Claim', 'How to check']}
          rows={[
            ['The 193-instrument universe exists on-chain', 'python -m app.verify_stocks — checks symbol() + non-zero totalSupply() for each'],
            ['A payout cycle happened', "Open the Distribution tab → the cycle's tx hash → view on the explorer"],
            ['The basket is 19 weighted instruments', '/api/index/payout-basket — weights sum to 100, every address RPC-verified'],
            ['Fees moved through the treasury', 'Treasury address on the explorer — inbound fee txs, outbound basket buys + pushes'],
            ['The API never fakes data', 'Every honest-empty state is in the code: live:false with a reason, never a placeholder number'],
          ]}
        />

        <Callout kind="warn">
          <Mono>$CLST</Mono> is not deployed yet. Until it is, steps 1–4 of the loop have
          nothing to run on: there is no treasury balance and no feed. The Distribution tab
          shows the honest pre-launch state, and <Mono>/api/distributions</Mono> returns{' '}
          <Mono>live: false</Mono> with the reason.
        </Callout>
      </>
    ),
  },
]
