import type { DocPage } from '../components'
import { Code, Mono, Callout, DataTable } from '../components'

export const agentPages: DocPage[] = [
  {
    slug: 'agents',
    title: 'The agents',
    tagline: 'All sixteen capabilities — what each does, what triggers its fee, and how to run one.',
    group: 'The product',
    keywords: ['agents', 'relay', 'scout', 'ledger', 'argus', 'pivot', 'catalogue', 'capabilities'],
    body: (
      <>
        <p className="t-body">
          Sixteen agents across six categories. Each has a ticker, a category, a fee
          trigger, and a blurb. The catalogue is static (<Mono>server/app/agents_catalogue.py</Mono>{' '}
          mirrors <Mono>app/src/data/agents.ts</Mono>) — agents are capabilities, not
          autonomous processes; dispatching one logs work against your wallet and
          exercises a real capability.
        </p>

        <h2 className="t-display mt-8 text-[20px]">The full catalogue</h2>
        <DataTable
          head={['Agent', 'Ticker', 'Category', 'Fee trigger', 'What it does']}
          rows={[
            ['Relay', 'RLY', 'Trading', 'Per swap', 'DEX trading agent. Routes swaps across pools and shares fees with holders.'],
            ['Scout', 'SCT', 'Research', 'Per report', 'Deep-research agent. Every commissioned report pays rewards to $CLST holders.'],
            ['Ledger', 'FIN', 'Finance', 'Per task', 'Bookkeeping and reconciliation agent. Settles in $CLST.'],
            ['Argus', 'ARG', 'Analysis', 'Per query', 'On-chain analysis agent watching flows, wallets and whales.'],
            ['Pivot', 'PVT', 'Trading', 'Per swap', 'Momentum trading agent for DEX markets. Fees stream back to holders.'],
            ['Prism', 'PRSM', 'Analysis', 'Per query', 'Breaks any dataset into signals. Queries pay holders.'],
            ['Memoria', 'MEM', 'Memory', 'Per task', 'Long-term memory agent. Stores, recalls and pays for every recall.'],
            ['Sifter', 'SFT', 'Research', 'Per report', 'Literature and source sifting agent for evidence-grade answers.'],
            ['Remit', 'RMT', 'Finance', 'Per task', 'Payments and invoicing agent. Each settled invoice drops rewards.'],
            ['Nexus', 'NXS', 'Crypto', 'Per task', 'Portfolio agent tracking wallets, positions and yield across chains.'],
            ['Echo', 'ECH', 'Memory', 'Per query', 'Conversation memory agent. Remembers everything, rewards holders.'],
            ['Census', 'CNS', 'Analysis', 'Per query', 'Market census agent. Counts, segments and ranks any market.'],
            ['Vault', 'VLT', 'Crypto', 'Per task', 'Treasury agent compounding idle balances into holder rewards.'],
            ['Quill', 'QLL', 'Research', 'Per report', 'Writing and synthesis agent for briefs, memos and summaries.'],
            ['Oracle', 'ORC', 'Crypto', 'Per query', 'Price and prediction feed agent. Every feed call pays a reward.'],
            ['Margin', 'MRG', 'Finance', 'Per task', 'Risk and margin agent. Keeps books balanced, holders paid.'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">By category</h2>
        <DataTable
          head={['Category', 'Count', 'Agents']}
          rows={[
            ['Trading', '2', 'Relay (RLY), Pivot (PVT)'],
            ['Research', '3', 'Scout (SCT), Sifter (SFT), Quill (QLL)'],
            ['Finance', '3', 'Ledger (FIN), Remit (RMT), Margin (MRG)'],
            ['Analysis', '3', 'Argus (ARG), Prism (PRSM), Census (CNS)'],
            ['Memory', '2', 'Memoria (MEM), Echo (ECH)'],
            ['Crypto', '3', 'Nexus (NXS), Vault (VLT), Oracle (ORC)'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Running an agent</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>Open the app → <strong>Agents</strong>. Browsing the catalogue needs no wallet.</li>
          <li>Pick an agent → <strong>Run</strong>. This opens the dispatch dialog.</li>
          <li>Connect a wallet if you haven't (the run logs against your address).</li>
          <li>Write a short brief — e.g. <em>"research the top Base AI infra protocols"</em> — and submit.</li>
          <li>The backend verifies your signature, logs the run, and stores a memory note for your wallet.</li>
          <li>Your run appears in <strong>Portfolio</strong> and <strong>History</strong>.</li>
        </ol>

        <Callout kind="note">
          <strong>Running is not a reward mechanic.</strong> Dispatching an agent logs that
          your wallet exercised a capability — it does not pay you. Holding <Mono>$CLST</Mono>{' '}
          is what earns a share of fees. The run endpoint returns <Mono>reward: 0</Mono>{' '}
          and <Mono>status: "logged"</Mono> by design.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Over the API</h2>
        <Code
          label="shell"
          code={`# list every agent
curl http://localhost:8000/api/agents

# filter by category
curl "http://localhost:8000/api/agents?category=Trading"

# one agent, full detail
curl http://localhost:8000/api/agents/scout`}
        />
        <p className="t-body mt-3">
          Dispatching a run needs a wallet signature (EIP-191). See{' '}
          <strong>Wallet &amp; auth</strong> for the full challenge → sign → submit flow,
          or use the MCP tools if you're driving from an AI agent.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Agent quotes</h2>
        <p className="t-body mt-3">
          Agents with a real trading analogue get a live quote in the UI — Relay→ETH,
          Pivot→BTC, Nexus→SOL, Oracle→BTC, Vault→ETH. The mapping is explicit and
          agents without an analogue are simply omitted — never mapped to a made-up
          number. Endpoint: <Mono>/api/market/agent-quotes</Mono>.
        </p>
      </>
    ),
  },

  {
    slug: 'basket',
    title: 'The basket & the universe',
    tagline: '193 tokenized stocks for trading, 19 instruments for payouts — and why they differ.',
    group: 'The product',
    keywords: ['basket', 'universe', 'stocks', '193', '19', 'payout', 'weights', 'robinhood'],
    body: (
      <>
        <p className="t-body">
          Two numbers matter, and they are <strong>deliberately different</strong>:
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <div className="t-display text-[24px]">193</div>
            <div className="t-small mt-0.5 font-medium">instruments in the universe</div>
            <div className="t-small mt-1" style={{ color: 'var(--ink-soft)' }}>
              For trading and market analysis. 192 independently RPC-verified on Robinhood Chain.
            </div>
          </div>
          <div className="rounded-xl border px-4 py-3.5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <div className="t-display text-[24px]">19</div>
            <div className="t-small mt-0.5 font-medium">instruments in the payout basket</div>
            <div className="t-small mt-1" style={{ color: 'var(--ink-soft)' }}>
              What holders are actually paid in — curated, weighted, summing to 100.
            </div>
          </div>
        </div>

        <Callout kind="warn">
          <strong>Don't conflate them.</strong> The full 193 exists so you can trade and
          analyse any of them. Holders are paid from the curated 19 — the same basket
          shape Kumo uses. Presenting the 193 as "what holders get" would be wrong; the
          app never does.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">The payout basket — 19 weighted instruments</h2>
        <DataTable
          head={['#', 'Symbol', 'Weight %']}
          rows={[
            ['1', 'NVDA', '14.2'],
            ['2', 'AAPL', '11.6'],
            ['3', 'MSFT', '10.3'],
            ['4', 'AMZN', '8.4'],
            ['5', 'GOOGL', '7.1'],
            ['6', 'META', '6.8'],
            ['7', 'TSLA', '6.2'],
            ['8', 'AMD', '5.4'],
            ['9', 'NFLX', '4.7'],
            ['10', 'ORCL', '4.1'],
            ['11', 'COIN', '3.6'],
            ['12', 'PLTR', '3.2'],
            ['13', 'CRWV', '2.8'],
            ['14', 'INTC', '2.6'],
            ['15', 'MU', '2.3'],
            ['16', 'BE', '2.1'],
            ['17', 'SPCX', '1.9'],
            ['18', 'SNDK', '1.4'],
            ['19', 'USAR', '1.3'],
          ]}
        />
        <p className="t-body mt-3">
          Weights sum to <Mono>100.0</Mono>. Every address is the same tokenized-stock
          contract used across the app, RPC-verified in{' '}
          <Mono>stocks_catalogue.py</Mono>. Check it live:
        </p>
        <Code label="shell" code={`curl http://localhost:8000/api/index/payout-basket`} />

        <h2 className="t-display mt-8 text-[20px]">The universe — 193 instruments</h2>
        <p className="t-body mt-3">
          The full tradeable/analysable set: 193 tokenized US-stock instruments deployed on
          Robinhood Chain. Each entry carries its symbol, name, contract address, and a{' '}
          <Mono>verified</Mono> flag. 192 of 193 are independently verified on-chain
          (symbol() matches + non-zero totalSupply()); one (BND) has zero total supply and
          is honestly marked unverified rather than hidden.
        </p>
        <Code
          label="shell"
          code={`# what the universe looks like
curl http://localhost:8000/api/index

# re-verify every instrument on-chain (needs RPC access)
cd server && python -m app.verify_stocks`}
        />

        <h2 className="t-display mt-8 text-[20px]">How the basket is maintained</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Weights live in one place:</strong>{' '}
            <Mono>server/app/payout_basket.py</Mono>. Keep them in sync with the keeper
            bot's config when <Mono>$CLST</Mono> ships.
          </li>
          <li>
            <strong>Verification is a command, not a promise:</strong>{' '}
            <Mono>python -m app.verify_stocks</Mono> re-checks every instrument against the
            chain. Re-run it any time.
          </li>
          <li>
            <strong>The payout basket ≠ the universe</strong> — that distinction is stated
            in the API response itself (<Mono>universe_count</Mono> vs <Mono>count</Mono>)
            so no client can misread it.
          </li>
        </ul>
      </>
    ),
  },
]
