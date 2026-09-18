import type { DocPage } from '../components'
import { Code, Mono, Callout, DataTable } from '../components'

export const extraPages: DocPage[] = [
  {
    slug: 'install',
    title: 'Install the skill',
    tagline: 'One skill, every agent runtime — Claude, Codex, Hermes, OpenClaw, npm, GitHub, MCP.',
    group: 'Getting started',
    keywords: ['install', 'skill', 'mcp', 'claude', 'codex', 'hermes', 'openclaw', 'npm', 'github', 'setup'],
    body: (
      <>
        <p className="t-body">
          The Cluster skill ships two ways: a <strong>MCP server</strong> (tools: quotes,
          index, swap, portfolio) and a <strong>SKILL.md recipe</strong> (finance, research,
          trading, memory workflows). Install once — every compatible runtime picks it up.
        </p>

        <h2 className="t-display mt-8 text-[20px]">MCP servers</h2>
        <Code label="shell" code={`# Claude Code\nclaude mcp add cluster --transport http https://agentindex-api.fly.dev/mcp\n\n# Codex\ncodex mcp add cluster --url https://agentindex-api.fly.dev/mcp\n\n# OpenClaw\nopenclaw mcp add cluster https://agentindex-api.fly.dev/mcp`} />

        <h2 className="t-display mt-8 text-[20px]">Hermes (SKILL.md)</h2>
        <Code label="shell" code={`hermes skill install https://raw.githubusercontent.com/rimurucook/cluster/main/skill/SKILL.md`} />
        <p className="t-small mt-2" style={{ color: 'var(--ink-soft)' }}>
          The raw-URL install is the same pattern used by the finchagentic skill — no clone needed.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Package managers</h2>
        <Code label="shell" code={`# npm\nnpm install cluster\n\n# GitHub\ngit clone https://github.com/rimurucook/cluster`} />

        <h2 className="t-display mt-8 text-[20px]">What you get</h2>
        <DataTable
          head={['Capability', 'Where it comes from']}
          rows={[
            ['Live stock quotes', <Mono key="1">GET /api/market/quotes</Mono>],
            ['Index composition (192 instruments)', <Mono key="2">GET /api/index</Mono>],
            ['Swap quotes on 4663', <Mono key="3">GET /api/trade/quote</Mono>],
            ['Distribution feed (realtime)', <Mono key="4">GET /api/distributions</Mono>],
            ['Chat with 24 vikey models', <Mono key="5">POST /api/chat</Mono>],
          ]}
        />
      </>
    ),
  },
  {
    slug: 'distribution',
    title: 'Distribution & the bot',
    tagline: 'How fees become basket payouts — and how the realtime feed stays honest.',
    group: 'The mechanism',
    keywords: ['distribution', 'bot', 'treasury', 'fees', 'basket', 'payout', 'realtime', 'feed'],
    body: (
      <>
        <p className="t-body">
          Cluster runs the same no-smart-contract treasury pattern as its sibling
          deployments: a keeper bot receives fees → buys the 19-name payout basket on
          Uniswap (Robinhood Chain 4663) → pushes pro-rata ERC-20 transfers to every
          eligible $CLST holder.
        </p>

        <h2 className="t-display mt-8 text-[20px]">The realtime feed</h2>
        <p className="t-body">
          The bot writes a snapshot (<Mono>latest.json</Mono>) roughly every 60 seconds:
          totals, recent buys (per-leg tx hashes), distribution history, payroll by
          wallet, and price history. The API serves it at{' '}
          <Mono>GET /api/distributions</Mono> — the dashboard and landing page read the
          same feed. Nothing is simulated: until the first real cycle lands, every
          figure is an honest zero.
        </p>
        <Code label="json" code={`{\n  \"live\": true,\n  \"mode\": \"live | dry\",\n  \"totals\": { \"buysUsd\": 0, \"distributedUsd\": 0, \"distributions\": 0 },\n  \"recentBuys\":  [...12 latest buy legs with tx hashes...],\n  \"recentDistributions\": [...],\n  \"payroll\": [...top holders by amount...],\n  \"priceHistory\": [...48 points...]\n}`} />

        <h2 className="t-display mt-8 text-[20px]">Safety model</h2>
        <DataTable
          head={['Rule', 'Behavior']}
          rows={[
            ['Default mode', 'DRY — plans + writes state, never signs'],
            ['Live mode', 'Only with --confirm-real-money + treasury key'],
            ['Gas reserve', 'Never touched; minimum balance enforced'],
            ['Routes', 'Derived once/hour, keccak-verified against DexScreener'],
            ['Restarts', 'lastDistributeAt persisted — no double-sends'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Cooming soon</h2>
        <p className="t-body">
          $CLST has no contract address yet, so the bot stays in <strong>fees-accumulate
          mode</strong>: it watches the treasury and plans, but never sends. When the CA
          is set (<Mono>AGENTINDEX_CA</Mono>), distribution unlocks automatically on the
          next pass — no redeploy.
        </p>
      </>
    ),
  },
  {
    slug: 'contracts',
    title: 'Contracts & addresses',
    tagline: 'Every address Cluster touches on Robinhood Chain — verified, not vibes.',
    group: 'The product',
    keywords: ['contracts', 'addresses', 'router', 'quoter', 'weth', 'usdg', 'explorer', 'chain', '4663'],
    body: (
      <>
        <p className="t-body">
          Cluster settles on <strong>Robinhood Chain (chain id 4663)</strong>. Every
          address below is the same set used by our other 4663 deployments and was verified
          on-chain before being wired in. The explorer is{' '}
          <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
            robinhoodchain.blockscout.com
          </a>
          .
        </p>

        <h2 className="t-display mt-8 text-[20px]">Trading contracts</h2>
        <DataTable
          head={['Contract', 'Address', 'What it is']}
          rows={[
            ['SwapRouter02', <Mono key="1">0xcaf681a66d020601342297493863e78c959e5cb2</Mono>, 'Executes in-app swaps (buy/sell multicall)'],
            ['QuoterV2', <Mono key="2">0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7</Mono>, 'Read-only price quotes — the backend proxies this call'],
            ['WETH', <Mono key="3">0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73</Mono>, 'Wrapped ETH — the hop asset for every route'],
            ['USDG', <Mono key="4">0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168</Mono>, 'Global Dollar — the stable hop option'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Chain parameters</h2>
        <DataTable
          head={['Parameter', 'Value']}
          rows={[
            ['Chain id', <Mono key="1">4663</Mono>],
            ['RPC', <Mono key="2">https://rpc.mainnet.chain.robinhood.com</Mono>],
            ['Explorer', <Mono key="3">https://robinhoodchain.blockscout.com</Mono>],
            ['Native gas token', 'ETH'],
            ['Block time', 'Sub-second — measured ~0.1s over 100 blocks'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">$CLST — the index token</h2>
        <p className="t-body mt-3">
          <strong>Cooming soon.</strong> The token is not deployed yet, and the docs will not
          pretend otherwise. Until it ships:
        </p>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>No contract address is shown anywhere in the app — there is nothing to copy yet.</li>
          <li><Mono>/api/index</Mono> reports <Mono>clst_deployed: false</Mono> and <Mono>clst_balance: null</Mono>.</li>
          <li>The launch switch is <Mono>AGENTINDEX_CLST_TOKEN_ADDRESS</Mono> in the backend env — set it and the app flips to live mode with zero code changes.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Route construction</h2>
        <p className="t-body mt-3">
          Quotes are built from a fixed candidate set, not a dynamic router:
        </p>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li><strong>Direct routes</strong> try fee tiers <Mono>500 / 3000 / 100</Mono> against the token.</li>
          <li><strong>Two-hop routes</strong> go through WETH or USDG across five (in, out) fee-tier pairs.</li>
          <li>Each candidate is quoted via <Mono>QuoterV2</Mono> and the best output wins; no route found returns an honest <Mono>ok:false</Mono>.</li>
        </ul>
        <Callout kind="warn">
          <strong>Never wrap ETH manually.</strong> The router pays the first WETH hop directly
          from <Mono>msg.value</Mono>; calling <Mono>wrapETH</Mono> first makes the swap revert
          with <Mono>STF</Mono>. Sells go through <Mono>unwrapWETH9</Mono> instead — both
          patterns are encoded in <Mono>app/src/lib/swap.ts</Mono>.
        </Callout>
      </>
    ),
  },
  {
    slug: 'security',
    title: 'Security model',
    tagline: 'What the server can and cannot do with your wallet — read this before you trust any app.',
    group: 'Platform',
    keywords: ['security', 'non-custodial', 'keys', 'signature', 'phishing', 'audit'],
    body: (
      <>
        <p className="t-body">
          Cluster is <strong>non-custodial</strong>. That is not a slogan here — it is an
          architectural fact you can verify in the code:
        </p>

        <h2 className="t-display mt-8 text-[20px]">The server never sees a key</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>The backend has <strong>no private-key handling anywhere</strong> — no signer library, no key env var, no wallet file.</li>
          <li>Swaps are <strong>built client-side</strong> (<Mono>app/src/lib/swap.ts</Mono>), signed by your wallet in the browser, and broadcast by your wallet.</li>
          <li>The backend's trading routes only <em>quote</em> (read-only <Mono>QuoterV2</Mono> calls over its own RPC proxy) and serve token metadata.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Signatures are scoped and single-use</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>Wallet-scoped routes (portfolio, history, runs, memory) require an <strong>EIP-191 signature</strong> over a server-issued challenge.</li>
          <li>Challenges are <strong>single-use</strong> and <strong>expire after 5 minutes</strong> — a captured signature cannot be replayed.</li>
          <li>The server recovers your address from the signature and compares; malformed input <strong>fails closed</strong> (401), never open.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">What a signature can never do</h2>
        <p className="t-body mt-3">
          The signature you provide is a plain message signature (<Mono>personal_sign</Mono>) —
          it proves you control the wallet. It is <strong>not a transaction</strong>, costs no
          gas, and cannot move funds. The challenge message says so explicitly.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Known honest limitations</h2>
        <DataTable
          head={['Limitation', 'Why', 'Mitigation']}
          rows={[
            ['Challenges stored in memory', 'Fine for a single-process self-hosted deploy', 'Swap for Redis if you run multiple workers'],
            ['Infinite router approval', 'Standard Uniswap pattern; one approval, then swaps', 'Revoke any time from your wallet or the explorer'],
            ['Public RPC dependency', 'Quotes need an RPC; the browser is 403-blocked cross-origin', 'Backend proxies with a short UA; swap the RPC URL if needed'],
          ]}
        />

        <Callout kind="warn">
          <strong>Trust nothing you cannot read.</strong> The whole stack is self-hostable
          precisely so you can audit it, change it, and run your own copy. If a claim in these
          docs does not match the code, the code wins — and please open an issue about the docs.
        </Callout>
      </>
    ),
  },
  {
    slug: 'mcp-clients',
    title: 'MCP clients',
    tagline: 'Wire Cluster into Claude Desktop, Cursor, Hermes, or anything else that speaks MCP.',
    group: 'Platform',
    keywords: ['mcp', 'claude', 'cursor', 'hermes', 'client', 'config', 'json'],
    body: (
      <>
        <p className="t-body">
          The MCP server speaks stdio, so any MCP client works. Three configurations we have
          actually run:
        </p>

        <h2 className="t-display mt-8 text-[20px]">Claude Desktop</h2>
        <p className="t-body mt-3">
          Edit <Mono>claude_desktop_config.json</Mono> (macOS:{' '}
          <Mono>~/Library/Application Support/Claude/</Mono>; Windows:{' '}
          <Mono>%APPDATA%\Claude\</Mono>):
        </p>
        <Code
          label="json"
          code={`{
  "mcpServers": {
    "cluster": {
      "command": "/absolute/path/to/cluster/mcp/run.sh",
      "env": { "AGENTINDEX_API_URL": "http://localhost:8000" }
    }
  }
}`}
        />

        <h2 className="t-display mt-8 text-[20px]">Cursor</h2>
        <p className="t-body mt-3">
          Same JSON shape, in <Mono>.cursor/mcp.json</Mono> (project) or the global{' '}
          <Mono>~/.cursor/mcp.json</Mono>.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Hermes Agent</h2>
        <Code
          label="shell"
          code={`hermes mcp add cluster \\
  --command "/absolute/path/to/cluster/mcp/run.sh" \\
  --env AGENTINDEX_API_URL=http://localhost:8000
hermes mcp list`}
        />

        <h2 className="t-display mt-8 text-[20px]">Prompts that work well</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>"Run the Scout agent for my wallet and tell me when it's done."</li>
          <li>"What's my Cluster activity this week?"</li>
          <li>"Remember that I only want Finance-category agents recommended."</li>
          <li>"Recall everything I've saved about ETH yield."</li>
        </ul>

        <Callout kind="tip">
          Start the backend first — the MCP server is a thin HTTP client and returns clean
          errors if <Mono>AGENTINDEX_API_URL</Mono> is unreachable. It holds no state of its own.
        </Callout>
      </>
    ),
  },
  {
    slug: 'faq',
    title: 'FAQ',
    tagline: 'Short answers to the questions the docs get asked most.',
    group: 'Reference',
    keywords: ['faq', 'questions', 'answers', 'when', 'how', 'why'],
    body: (
      <>
        <h2 className="t-display text-[20px]">Do I need a wallet to look around?</h2>
        <p className="t-body mt-3">
          No. Market, agents, basket, docs and quotes all work without a wallet. A wallet is
          required only for wallet-scoped views (portfolio, history) and for executing a trade.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Is $CLST live?</h2>
        <p className="t-body mt-3">
          <strong>Cooming soon.</strong> The token is not deployed. The app renders honest
          pre-launch states everywhere — no fake CA, no fake balance, no fake trade links.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Are the market numbers real?</h2>
        <p className="t-body mt-3">
          Yes — live Yahoo Finance data for the 193 tokenized stocks, served through the
          backend with caching. Where data is missing (one instrument with zero supply, a
          symbol Yahoo does not cover) the API returns an honest null or omits the row.
          It never fabricates a number.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Do agents trade my money?</h2>
        <p className="t-body mt-3">
          No. Agents log runs and produce briefs; trading is a manual, wallet-signed action
          you take in the Trade view. Running an agent is <strong>not</strong> a reward
          mechanic — runs return <Mono>reward:0</Mono>.
        </p>

        <h2 className="t-display mt-8 text-[20px]">What is the difference between the universe and the basket?</h2>
        <p className="t-body mt-3">
          The <strong>universe</strong> is 193 tokenized stocks available for trade and
          analysis. The <strong>payout basket</strong> is 19 weighted instruments holders are
          actually paid in. Everything in the basket is in the universe; not the other way
          around.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Where does yield come from?</h2>
        <p className="t-body mt-3">
          Trading fees accumulated by the system, swapped into the payout basket by a keeper
          bot, then distributed. No staking emissions, no token inflation games — fees in,
          basket out.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Can I run my own copy?</h2>
        <p className="t-body mt-3">
          Yes — that is the point. Backend, frontend and MCP server are three independent
          parts; the <strong>Self-hosting</strong> page walks through all of them in order.
        </p>

        <h2 className="t-display mt-8 text-[20px]">How do I install the agent skill?</h2>
        <Code
          label="shell"
          code={`hermes skills install https://raw.githubusercontent.com/finchagentic/cluster-skill/main/SKILL.md --name cluster --yes`}
        />
      </>
    ),
  },
  {
    slug: 'roadmap',
    title: 'Roadmap & status',
    tagline: 'What is live, what is coming — dated honestly, no vague promises.',
    group: 'Reference',
    keywords: ['roadmap', 'status', 'live', 'coming', 'launch', 'clst'],
    body: (
      <>
        <h2 className="t-display text-[20px]">Live today</h2>
        <DataTable
          head={['Piece', 'State']}
          rows={[
            ['Backend API (FastAPI + SQLite)', 'Live — 24 routes'],
            ['Frontend site + app (React + Vite)', 'Live'],
            ['Market data (193 stocks, movers, sectors, charts)', 'Live'],
            ['In-app trading (quote + swap build, Robinhood Chain)', 'Live — quote verified end-to-end'],
            ['Agent catalogue (16 agents, 6 categories)', 'Live'],
            ['Memory layer (retain / recall / consolidate)', 'Live'],
            ['MCP server (9 tools)', 'Live'],
            ['Agent skill on GitHub', 'Live — raw-URL install verified'],
            ['Docs (this site)', 'Live'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">Cooming soon</h2>
        <DataTable
          head={['Piece', 'State', 'Blocker']}
          rows={[
            ['$CLST token', 'Cooming soon', 'Awaiting deploy — flip AGENTINDEX_CLST_TOKEN_ADDRESS to launch'],
            ['Distribution cycles', 'Cooming soon', 'First keeper cycle not yet run; feed URL not wired'],
            ['Real-money swap broadcast', 'Verified to tx-build', 'Needs a funded wallet — quote + build paths are done'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">How to read this page</h2>
        <p className="t-body mt-3">
          Anything not marked live above is not live. The app itself follows the same rule:
          where data does not exist yet it shows an honest empty state rather than a
          placeholder that looks real.
        </p>
      </>
    ),
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    tagline: 'The vocabulary used across the app and these docs, in plain language.',
    group: 'Reference',
    keywords: ['glossary', 'terms', 'definitions', 'vocabulary'],
    body: (
      <>
        <DataTable
          head={['Term', 'Meaning']}
          rows={[
            ['Universe', 'The 193 tokenized stocks on Robinhood Chain that can be traded and analyzed.'],
            ['Payout basket', 'The 19 weighted instruments holders are actually paid in — a curated subset of the universe.'],
            ['Run', 'One dispatched agent task, logged against a wallet. Returns a status, not a reward.'],
            ['Agent capability', 'One of 16 catalogue entries (Relay, Scout, Ledger, …), each mapped to a real function.'],
            ['Memory bank', 'The per-wallet store behind retain/recall/consolidate. Identified by bank_id.'],
            ['Consolidation', 'Two-pass memory roll-up: the caller writes the summary, the server stores it tagged "consolidated".'],
            ['Time decay', 'Recall weighting that halves a note\'s score every 90 days — newer notes win ties.'],
            ['Challenge', 'A single-use, 5-minute message a wallet signs to prove ownership (EIP-191).'],
            ['QuoterV2', 'The on-chain read-only contract that prices a swap before you sign anything.'],
            ['Slippage floor', 'The minimum output a swap accepts — Cluster defaults to 1% (amountOutMinimum).'],
            ['msg.value', 'The ETH attached to a buy transaction; the router consumes it for the first WETH hop.'],
            ['Cooming soon', 'Our deliberate, verbatim pre-launch label. If you see it, that thing is not live yet.'],
          ]}
        />
      </>
    ),
  },
  {
    slug: 'chat',
    title: 'Chat & credits',
    tagline: 'Every wallet gets $5 of inference credit — the wallet is the account.',
    group: 'The product',
    keywords: ['chat', 'credit', 'vikey', 'models', 'gpt', 'claude', 'gemini', 'deepseek', 'astra', 'inference'],
    body: (
      <>
        <p className="t-body">
          The <strong>Chat</strong> tab is a direct line to the same model fleet the agents
          run on, proxied through this server's LLM gateway. Sign in with your wallet and
          you have <strong>$5 of credit</strong> — no card, no email, no signup form. The
          wallet address is the account.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Models</h2>
        <p className="t-body mt-3">
          The picker groups 24 models into five buckets. Every one of them is live on the
          gateway — the list is fetched from <Mono>GET /api/chat/models</Mono>, never hardcoded
          in the frontend:
        </p>
        <DataTable
          head={['Group', 'Examples', 'Pick it for']}
          rows={[
            ['Frontier', 'GPT-6 Astra, Claude Opus 5, GPT-5.6 Terra', 'The hardest analysis, long reasoning chains'],
            ['Balanced', 'Claude Sonnet 5, Qwen 3.8 Max, GLM 5.3', 'Everyday agent work at a sane price'],
            ['Fast', 'Gemini 3.8 Flash, GPT-5.6 Luna, Claude Fable 5.1', 'Quick lookups, chat, iteration'],
            ['Reasoning', 'DeepSeek V4 Pro, Kimi K3, Gemini 3.7 Flash High', 'Multi-step math and trade planning'],
            ['Code', 'Kimi K2.7 Code', 'Writing or reviewing scripts and contracts'],
          ]}
        />

        <h2 className="t-display mt-8 text-[20px]">How metering works</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>Every request is priced per token (in/out) against the model's published rate.</li>
          <li>Cost is deducted from your $5 and shown live in the chat header (<Mono>$X.XX left</Mono>).</li>
          <li>The raw gateway key lives only on the server — your browser never sees it.</li>
          <li>At $0 remaining the endpoint returns <Mono>402</Mono>. Top-ups are not open yet; the UI says so instead of pretending.</li>
        </ul>
        <Callout kind="note">
          <strong>Your wallet must sign.</strong> The first message of a session asks for a
          signature (EIP-191, no gas). That signature is what binds the credit account to
          you — nobody can spend your $5 without your key.
        </Callout>

        <h2 className="t-display mt-8 text-[20px]">From the API</h2>
        <Code
          label="shell"
          code={`# 1. remaining credit (public read)\ncurl "$API/api/chat/credits?wallet=0xYourWallet"\n\n# 2. models\ncurl "$API/api/chat/models"\n\n# 3. a completion (wallet signature required)\ncurl -X POST "$API/api/chat" -H 'Content-Type: application/json' -d '{\n  "wallet": "0xYourWallet",\n  "signature": "<personal_sign of the challenge>",\n  "model": "openai/gpt-6-astra",\n  "messages": [{"role": "user", "content": "Analyze NVDA earnings drift"}]\n}'`}
        />
      </>
    ),
  },
  {
    slug: 'api-keys',
    title: 'API keys',
    tagline: 'Generate a key from the wallet that owns it — hashed at rest, shown once.',
    group: 'Platform',
    keywords: ['api', 'key', 'token', 'generate', 'revoke', 'settings', 'bearer', 'clst_'],
    body: (
      <>
        <p className="t-body">
          The <strong>Settings</strong> tab issues API keys for the Cluster endpoint. A key
          is bound to the wallet that created it: you sign a challenge, the server mints{' '}
          <Mono>clst_&lt;prefix&gt;_&lt;secret&gt;</Mono>, and shows it <strong>exactly once</strong>.
          Only a SHA-256 hash is stored, so a lost key is revoked and replaced — never recovered.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Generate a key</h2>
        <ol className="t-body mt-3 list-decimal space-y-2 pl-5">
          <li>Connect your wallet and open <strong>Settings</strong>.</li>
          <li>Click <strong>Generate key</strong>, name it, and sign the challenge.</li>
          <li>Copy the key from the reveal banner immediately — it will not be shown again.</li>
        </ol>

        <h2 className="t-display mt-8 text-[20px]">Use it</h2>
        <Code
          label="shell"
          code={`# List your keys (wallet signature required)\ncurl "$API/api/keys?wallet=0xYourWallet&signature=<sig>"\n\n# Create one\ncurl -X POST "$API/api/keys" -H 'Content-Type: application/json' -d '{\n  "wallet": "0xYourWallet", "signature": "<sig>", "name": "my-bot"\n}'\n\n# Revoke\ncurl -X DELETE "$API/api/keys/7" -H 'Content-Type: application/json' -d '{\n  "wallet": "0xYourWallet", "signature": "<sig>"\n}'`}
        />
        <Callout kind="warn">
          Keys are shown once. The server stores only the hash — if you lose the raw key,
          revoke it and mint a new one. Up to 20 active keys per wallet.
        </Callout>
      </>
    ),
  },
  {
    slug: 'social',
    title: 'Social & tips',
    tagline: 'Link your X handle to your wallet and tip in $CLST — the social layer.',
    group: 'The product',
    keywords: ['social', 'x', 'twitter', 'tip', 'clst', 'profile', 'handle', 'link'],
    body: (
      <>
        <p className="t-body">
          <strong>Profile</strong> is your public page: the wallet address, its X handle,
          tip counters, and the portfolio snapshot. Everything is wallet-scoped — no
          email, no password, no server-side identity beyond what you sign for.
        </p>

        <h2 className="t-display mt-8 text-[20px]">Link X</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>Sign a challenge, submit your handle, and the link is recorded against your wallet.</li>
          <li>One handle per wallet, one wallet per handle — the server rejects duplicates with <Mono>409</Mono>.</li>
          <li>Unlink any time by submitting an empty handle.</li>
        </ul>

        <h2 className="t-display mt-8 text-[20px]">Tips in $CLST</h2>
        <ul className="t-body mt-3 list-disc space-y-2 pl-5">
          <li>Send a tip to any wallet address with an optional note; the intent is recorded and counters update.</li>
          <li>Receiving shows up on your profile as <Mono>tips_received</Mono> with the running total.</li>
          <li>On-chain settlement waits for the $CLST token to deploy — the API returns <Mono>tx_hash: null</Mono> and says so, rather than inventing a hash.</li>
        </ul>
        <Code
          label="shell"
          code={`# Public profile (no auth)\ncurl "$API/api/social/profile?wallet=0xTheirWallet"\n\n# Link X (signature required)\ncurl -X POST "$API/api/social/link-x" -H 'Content-Type: application/json' -d '{\n  "wallet": "0xYourWallet", "signature": "<sig>", "handle": "@yourhandle"\n}'\n\n# Tip\ncurl -X POST "$API/api/social/tip" -H 'Content-Type: application/json' -d '{\n  "wallet": "0xYourWallet", "signature": "<sig>",\n  "to": "0xTheirWallet", "amount": "25", "note": "good alpha"\n}'`}
        />
      </>
    ),
  },
]
