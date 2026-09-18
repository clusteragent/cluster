import type { DocPage } from '../components'
import { Code, Mono, Callout, DataTable, Endpoint } from '../components'

export const platformPages: DocPage[] = [
  {
    slug: 'mcp',
    title: 'MCP server',
    tagline: 'Let any AI agent drive Cluster — nine tools over the Model Context Protocol.',
    group: 'Platform',
    keywords: ['mcp', 'claude', 'cursor', 'tools', 'integration', 'ai agent'],
    body: (
      <>
        <p className="t-body">
          The <Mono>mcp/</Mono> folder is a Model Context Protocol server that exposes
          Cluster to any MCP-capable client — Claude Desktop, Cursor, Hermes, and
          anything else that speaks the protocol. It's the bridge that makes Cluster
          usable <em>by</em> agents, not just <em>for</em> them.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Run it</h2>
        <Code label="shell" code={`cd mcp\n./run.sh          # creates .venv on first run, then serves over stdio`} />
        <p className="t-body mt-3">
          It talks to the backend over HTTP (<Mono>AGENTINDEX_API_URL</Mono>, default{' '}
          <Mono>http://localhost:8000</Mono>), so start the backend first.
        </p>

        <h2 className="t-display mt-8 text-[20px]">The nine tools</h2>
        <DataTable
          head={['Tool', 'What it does', 'Backs onto']}
          rows={[
            ['list_agents', 'List the 16-agent catalogue (filter by category or search)', <Mono key="1">GET /api/agents</Mono>],
            ['get_agent', "One agent's full detail", <Mono key="2">GET /api/agents/&#123;id&#125;</Mono>],
            ['run_agent', 'Dispatch a run — logs against a wallet', <Mono key="3">POST /api/runs</Mono>],
            ['clear_run', 'Reset a run status (dev aid)', <Mono key="4">runs store</Mono>],
            ['get_portfolio', 'Wallet-scoped activity summary', <Mono key="5">GET /api/portfolio</Mono>],
            ['get_history', 'Wallet-scoped run events', <Mono key="6">GET /api/portfolio/history</Mono>],
            ['remember', 'Retain a memory note (dedupes automatically)', <Mono key="7">POST /api/memory/retain</Mono>],
            ['recall', 'Keyword + recency-ranked recall of stored notes', <Mono key="8">POST /api/memory/recall</Mono>],
            ['consolidate_memory', 'Store a roll-up summary tagged "consolidated"', <Mono key="9">POST /api/memory/consolidate</Mono>],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Wire it into a client</h2>
        <p className="t-body mt-3">
          Claude Desktop (<Mono>claude_desktop_config.json</Mono>):
        </p>
        <Code
          label="json"
          code={`{
  "mcpServers": {
    "cluster": {
      "command": "/absolute/path/to/mcp/run.sh",
      "env": { "AGENTINDEX_API_URL": "http://localhost:8000" }
    }
  }
}`}
        />
        <p className="t-body mt-3">
          Any other client: point it at the same command. The server speaks stdio MCP —
          no ports, no auth, local only.
        </p>

        <Callout kind="tip">
          <strong>Wallet note for run_agent:</strong> a run needs a wallet + signature
          (see <strong>Wallet &amp; auth</strong>). For local agent testing you can set{' '}
          <Mono>AGENTINDEX_DEV_AUTH_BYPASS=1</Mono> on the backend — loudly logged,
          never for production.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">Also available as a skill</h2>
        <p className="t-body mt-3">
          Prefer a higher-level integration? The companion skill repo teaches a coding
          agent how to use Cluster end to end (API + swap execution):
        </p>
        <Code
          label="shell"
          code={`hermes skills install https://raw.githubusercontent.com/finchagentic/cluster-skill/main/SKILL.md --name cluster --yes`}
        />
        <p className="t-body mt-3">
          Repo:{' '}
          <a
            href="https://github.com/finchagentic/cluster-skill"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'underline' }}
          >
            github.com/finchagentic/cluster-skill
          </a>{' '}
          — SKILL.md plus <Mono>references/api.md</Mono> and{' '}
          <Mono>references/swap.md</Mono>.
        </p>
      </>
    ),
  },

  {
    slug: 'memory',
    title: 'Memory layer',
    tagline: 'Retain, recall, consolidate — SQLite by default, swappable backend.',
    group: 'Platform',
    keywords: ['memory', 'retain', 'recall', 'consolidate', 'sqlite', 'notes'],
    body: (
      <>
        <p className="t-body">
          The memory layer is what makes Cluster agents stateful: notes are retained
          per wallet, recalled by relevance, and consolidated into summaries over time.
          It's also the default place agent run history lives.
        </p>

        <h2 className="t-display mt-8 text-[20px]">The three operations</h2>
        <DataTable
          head={['Operation', 'Signature', 'Purpose']}
          rows={[
            ['Retain', 'bank_id, content, agent_id?, title?, tags?, force?', 'Store a note — bounded at 4,000 chars, dedupes identical content unless force'],
            ['Recall', 'bank_id, query, limit?', 'Score every note for the bank, return the top-ranked'],
            ['Consolidate', 'bank_id, topic, summary, source_ids?', "Store an LLM-written roll-up tagged 'consolidated'; originals untouched"],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">How recall ranks</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li><strong>Keyword overlap × time decay</strong> — a note scores its count of matching query terms, multiplied by a recency weight. Newer notes with the same wording win.</li>
          <li><strong>Keyword miss → recent notes</strong> — if nothing matches, recall falls back to the most recent notes for the bank (still decay-weighted, not insertion order).</li>
          <li><strong>No hidden model</strong> — no embeddings, no LLM in the ranking path. You can read the scoring in <Mono>server/app/memory.py</Mono> and predict exactly why any note ranked where it did.</li>
        </ol>

        <h2 className="t-display mt-8 text-[20px]">API</h2>
        <Endpoint method="POST" path="/api/memory/retain" />
        <Code
          label="shell"
          code={`curl -X POST http://localhost:8000/api/memory/retain \\
  -H 'content-type: application/json' \\
  -d '{"bank_id":"0xYou","content":"scout brief: top Base AI infra","agent_id":"scout","tags":["research"]}'`}
        />
        <Endpoint method="POST" path="/api/memory/recall" />
        <Code
          label="shell"
          code={`curl -X POST http://localhost:8000/api/memory/recall \\
  -H 'content-type: application/json' \\
  -d '{"bank_id":"0xYou","query":"Base AI infra","limit":5}'`}
        />
        <Endpoint method="POST" path="/api/memory/consolidate" />
        <Code
          label="shell"
          code={`curl -X POST http://localhost:8000/api/memory/consolidate \\
  -H 'content-type: application/json' \\
  -d '{"bank_id":"0xYou","topic":"Base AI infra","summary":"...","source_ids":[1,2,3]}'`}
        />
        <p className="t-body mt-3">
          <strong>Two-pass consolidation:</strong> the caller (an LLM holding the recalled
          notes in context) writes the summary; the server just stores it. No server-side
          LLM call, no API key required.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Storage</h2>
        <p className="t-body mt-3">
          Default: SQLite at <Mono>server/cluster.db</Mono> — zero extra services,
          survives restarts, inspectable with any sqlite client. The{' '}
          <Mono>MEMORY_BACKEND</Mono> env var selects the implementation; the SQLite
          backend ships in-tree.
        </p>
        <Callout kind="warn">
          Wallet-scoped endpoints require a signature (see{' '}
          <strong>Wallet &amp; auth</strong>) — notes are private to the wallet that wrote
          them. The curl examples above work as-is only with{' '}
          <Mono>AGENTINDEX_DEV_AUTH_BYPASS=1</Mono> in local dev.
        </Callout>
      </>
    ),
  },

  {
    slug: 'self-host',
    title: 'Self-hosting',
    tagline: 'Three parts, run in order. SQLite by default — works on a small VPS.',
    group: 'Platform',
    keywords: ['self-host', 'deploy', 'vps', 'production', 'systemd', 'nginx'],
    body: (
      <>
        <p className="t-body">
          The whole stack is self-hostable — three parts, run in order from the project
          root:
        </p>
        <Code
          label="shell"
          code={`# 1. Backend
cd server && cp .env.example .env && ./run.sh        # :8000

# 2. Frontend (build + serve the dist/)
cd app && npm install && npm run build               # outputs app/dist
# serve app/dist with any static host (nginx, caddy, vite preview)

# 3. MCP (optional)
cd mcp && ./run.sh`}
        />

        <h2 className="t-display mt-8 text-[20px]">Minimum requirements</h2>
        <DataTable
          head={['Resource', 'Minimum', 'Notes']}
          rows={[
            ['CPU', '1 vCPU', 'Everything is light — SQLite, no workers'],
            ['RAM', '512 MB', 'Backend + static frontend; MCP adds ~100 MB'],
            ['Disk', '1 GB', 'SQLite DB + node_modules during build'],
            ['Runtime', 'Python 3.11+, Node 18+', 'Both standard'],
            ['Network', 'Outbound HTTPS', 'Yahoo Finance (market), RPC (chain). Public RPC works'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Production notes</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Point the frontend at your backend:</strong> build with{' '}
            <Mono>VITE_API_BASE=https://api.yourhost</Mono>, or reverse-proxy{' '}
            <Mono>/api</Mono> to the backend on the same origin (simplest — no CORS).
          </li>
          <li>
            <strong>Keep <Mono>AGENTINDEX_DEV_AUTH_BYPASS</Mono> unset.</strong> It exists
            for local curl only.
          </li>
          <li>
            <strong>Re-verify the universe</strong> after any RPC change:{' '}
            <Mono>cd server && python -m app.verify_stocks</Mono>.
          </li>
          <li>
            <strong>Back up <Mono>server/cluster.db</Mono></strong> if you care about
            memory + run history. It's a single file — copy it.
          </li>
          <li>
            <strong>Yahoo rate limits:</strong> market endpoints cache for 60s; a tiny
            instance polling on demand is fine. See <strong>Troubleshooting</strong> if you
            get 429s.
          </li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Systemd sketch</h2>
        <Code
          label="ini"
          code={`[Unit]
Description=Cluster backend
After=network.target

[Service]
WorkingDirectory=/opt/cluster/server
ExecStart=/opt/cluster/server/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target`}
        />

        <Callout kind="tip">
          No contract to deploy, no on-chain step to self-host. Distribution is a keeper
          bot you run when <Mono>$CLST</Mono> ships — see the{' '}
          <strong>Distribution</strong> page for the feed contract between bot and app.
        </Callout>
      </>
    ),
  },

  {
    slug: 'configuration',
    title: 'Configuration',
    tagline: 'Every environment variable, what it does, and the safe default.',
    group: 'Platform',
    keywords: ['config', 'env', 'variables', 'environment', 'settings'],
    body: (
      <>
        <p className="t-body">
          All backend config lives in <Mono>server/.env</Mono> (copy from{' '}
          <Mono>.env.example</Mono>). Defaults are safe: the stack boots with zero keys.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Backend</h2>
        <DataTable
          head={['Variable', 'Default', 'Purpose']}
          rows={[
            [<Mono key="1">MEMORY_BACKEND</Mono>, 'sqlite', 'Memory storage engine — sqlite ships in-tree'],
            [<Mono key="2">AGENTINDEX_DB_PATH</Mono>, 'cluster.db', 'SQLite file location'],
            [<Mono key="3">AGENTINDEX_RPC_URL</Mono>, 'public RH RPC', 'Robinhood Chain RPC for quotes + verification'],
            [<Mono key="4">AGENTINDEX_FEED_URL</Mono>, '(unset)', 'Distribution snapshot URL — set when $CLST ships'],
            [<Mono key="5">AGENTINDEX_CLST_TOKEN_ADDRESS</Mono>, '(unset)', 'The $CLST contract — flips the UI from "Cooming soon" to live'],
            [<Mono key="6">AGENTINDEX_TREASURY_ADDRESS</Mono>, '(unset)', 'Treasury address shown in Distribution'],
            [<Mono key="7">AGENTINDEX_DEV_AUTH_BYPASS</Mono>, '(unset)', 'Skips wallet signature checks. LOCAL DEV ONLY'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Frontend</h2>
        <DataTable
          head={['Variable', 'Default', 'Purpose']}
          rows={[
            [<Mono key="1">VITE_API_BASE</Mono>, 'same-origin /api', 'Backend base URL for production builds'],
          ]}
        />
        <p className="t-body mt-3">
          Wallet config (Reown projectId, chain 4663) is in{' '}
          <Mono>app/src/lib/web3.ts</Mono>. The projectId is a public browser key — safe
          in the bundle; replace it if you fork for another project.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Launch-day checklist</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>Deploy <Mono>$CLST</Mono> on Robinhood Chain (4663).</li>
          <li>Set <Mono>AGENTINDEX_CLST_TOKEN_ADDRESS</Mono> + <Mono>AGENTINDEX_TREASURY_ADDRESS</Mono> → restart backend.</li>
          <li>Start the keeper bot; wait for its first cycle; confirm <Mono>latest.json</Mono> is published.</li>
          <li>Set <Mono>AGENTINDEX_FEED_URL</Mono> to the snapshot's raw URL → restart backend.</li>
          <li>Check: <Mono>/api/index</Mono> shows <Mono>clst_deployed: true</Mono>; Distribution tab shows cycles.</li>
        </ol>
        <Callout kind="note">
          No code change on launch day — every switch is an env var. That's deliberate: the
          honest "Cooming soon" states and the live states are the same code path with
          different data.
        </Callout>
      </>
    ),
  },

  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    tagline: 'The failures we actually hit — and the fix for each.',
    group: 'Platform',
    keywords: ['errors', 'problems', 'fix', 'debug', '429', '403', 'rpc', 'failed'],
    body: (
      <>
        <p className="t-body">
          Every entry below is a real failure from building this stack, with the real fix.
          If something breaks that isn't here, the fastest path is{' '}
          <Mono>Status</Mono> in the app — it runs live checks and shows exactly which
          dependency is down.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Market data returns 502 / empty</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Cause:</strong> Yahoo throttling your host (HTTP 429), usually datacenter IPs with a long desktop User-Agent.</li>
          <li><strong>Fix:</strong> the backend already sends the short <Mono>Mozilla/5.0</Mono> UA. If it still fails, wait 60s (the cache cools), or run behind a residential egress.</li>
          <li><strong>Never:</strong> patch in fallback prices. The 502 is the correct behavior.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">RPC returns 403</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Cause:</strong> the public Robinhood Chain RPC blocks requests without a browser-like User-Agent.</li>
          <li><strong>Fix:</strong> send <Mono>User-Agent: Mozilla/5.0</Mono> on every JSON-RPC call — the backend does; copy that if you write your own client.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Quote works, execute reverts with STF</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Cause:</strong> calling <Mono>wrapETH</Mono> before <Mono>exactInput</Mono> on a buy.</li>
          <li><strong>Fix:</strong> don't wrap. Send the ETH as <Mono>msg.value</Mono> on the <Mono>exactInput</Mono> call; the router pays the first WETH hop from it directly. Sells unwrap via <Mono>unwrapWETH9</Mono> in the same multicall.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Wallet won't connect / disconnects</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Cause:</strong> wrong chain. Everything is Robinhood Chain 4663.</li>
          <li><strong>Fix:</strong> let AppKit switch chains on connect; if your wallet doesn't know 4663, add it (chainId 4663, RPC <Mono>https://rpc.mainnet.chain.robinhood.com</Mono>).</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">401 on portfolio / history / runs</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Cause:</strong> missing or expired signature — challenges are single-use and last 5 minutes.</li>
          <li><strong>Fix:</strong> re-run the challenge → sign → retry flow. If you're curl-testing locally, that's what <Mono>AGENTINDEX_DEV_AUTH_BYPASS=1</Mono> is for (local only).</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Distribution tab stuck on "no cycles"</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Cause (pre-launch):</strong> expected — <Mono>$CLST</Mono> isn't deployed, no fees, no cycles. Not a bug.</li>
          <li><strong>Cause (post-launch):</strong> <Mono>AGENTINDEX_FEED_URL</Mono> unset or the bot hasn't published yet.</li>
          <li><strong>Fix:</strong> check <Mono>/api/distributions</Mono> — it tells you <em>which</em> of the two it is in the <Mono>reason</Mono> field.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Diagnose everything at once</h2>
        <Code
          label="shell"
          code={`curl http://localhost:8000/health          # backend up?
curl http://localhost:8000/api/trade/status # RPC + gas
curl http://localhost:8000/api/market/movers # Yahoo reachable?
# or open the app → Status tab (live checks + changelog)`}
        />
      </>
    ),
  },
]
