#!/usr/bin/env node
/**
 * Cluster MCP server — the runtime layer for agentic finance on Robinhood Chain.
 *
 * Tools (all zero private keys — swaps are quoted here, signed by YOUR wallet):
 *   get_quotes          — batch quotes + daily closes for tokenized stocks & crypto
 *   get_movers          — gainers, losers, sector heat across 192 instruments
 *   get_news            — Yahoo Finance headlines
 *   get_chart           — candles + series per symbol/timeframe
 *   get_index           — index composition, on-chain verified
 *   get_payout_basket   — the 19-name basket that pays $CLST holders
 *   get_distributions   — payout cycles, payroll, treasury (public record)
 *   quote_swap          — Uniswap v3 route + amountOut (amount in wei)
 *   trade_status        — router, quoter, gas, ETH price
 *   wallet_balances     — on-chain balances for any address (native ETH + holdings)
 *   get_models          — 24-model LLM gateway list w/ pricing
 *   chat                — one completion (thinking flag = extended reasoning)
 *   get_credits         — inference credit balance for a wallet
 *   memory_retain       — store a durable, deduped memory note
 *   memory_recall       — recall stored notes
 *   list_keys / create_key / key_usage — API key management
 *
 * Env:
 *   CLUSTER_API_URL  — cluster backend base URL (default: hosted endpoint)
 *   CLUSTER_API_KEY  — clst_... key for wallet-scoped tools (optional for market data)
 *   CLUSTER_WALLET   — default wallet address for wallet-scoped tools
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API = (process.env.CLUSTER_API_URL || "https://clusteragent.dev").replace(/\/$/, "");
const KEY = process.env.CLUSTER_API_KEY || "";
const WALLET = process.env.CLUSTER_WALLET || "";

async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (KEY) headers["X-API-Key"] = KEY;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    return { error: true, status: res.status, detail: data?.detail ?? data?.raw ?? text.slice(0, 200) };
  }
  return data;
}

const json = (d) => ({ content: [{ type: "text", text: JSON.stringify(d, null, 2) }] });
const err = (msg) => ({ content: [{ type: "text", text: `Error: ${msg}` }], isError: true });

function walletArgs(args) {
  const wallet = args?.wallet || WALLET;
  if (!wallet) throw new Error("No wallet address — pass `wallet` or set CLUSTER_WALLET");
  return { wallet, session_token: args?.session_token || undefined, signature: args?.signature || undefined };
}

const TOOLS = [
  {
    name: "get_quotes",
    description: "Batch quotes + ~1 month of daily closes for tokenized stocks/ETFs and crypto on Robinhood Chain. Symbols: NVDA, SPY, TSLA, PONS, WETH, USDG, CLIPPY, KARMA, ...",
    inputSchema: { type: "object", properties: { symbols: { type: "string", description: "Comma-separated symbols, e.g. 'NVDA,SPY,PONS'" } }, required: ["symbols"] },
  },
  {
    name: "get_movers",
    description: "Live gainers, losers and sector heat across the 192-instrument universe.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "Rows per side (default 10)" } } },
  },
  { name: "get_news", description: "Yahoo Finance market headlines.", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  {
    name: "get_chart",
    description: "Price series + candles for a symbol (NVDA, SPY, PONS, ...).",
    inputSchema: { type: "object", properties: { symbol: { type: "string" }, tf: { type: "string", description: "1d|5d|1mo|3mo|6mo|1y" } }, required: ["symbol"] },
  },
  { name: "get_index", description: "Cluster index composition: 193 instruments, on-chain verified count, $CLST status.", inputSchema: { type: "object", properties: {} } },
  { name: "get_payout_basket", description: "The 19-name payout basket with weights — what $CLST holders get paid from.", inputSchema: { type: "object", properties: {} } },
  { name: "get_distributions", description: "Distribution cycles, per-cycle aggregates, basket buys and treasury balance — the public payout record. Recipient lists are never public.", inputSchema: { type: "object", properties: {} } },
  {
    name: "quote_swap",
    description: "Uniswap v3 route + amountOut for a swap on Robinhood Chain (4663). amount is in WEI of the input token. Read-only — execution happens in the user's wallet.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string", description: "Output token contract address" },
        side: { type: "string", description: "buy (ETH->token) or sell (token->ETH)" },
        amount: { type: "string", description: "Amount in wei of input token" },
        via: { type: "string", description: "USDG or WETH hop preference" },
      },
      required: ["token", "side", "amount"],
    },
  },
  { name: "trade_status", description: "Router, quoter, WETH, USDG, gas price, ETH USD rate for Robinhood Chain.", inputSchema: { type: "object", properties: {} } },
  {
    name: "wallet_balances",
    description: "On-chain balances for any address on Robinhood Chain: native ETH + every held token. Read-only, no auth.",
    inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  },
  { name: "get_models", description: "24-model LLM gateway list with context windows and USD pricing per 1M tokens.", inputSchema: { type: "object", properties: {} } },
  {
    name: "chat",
    description: "One completion through the cluster LLM gateway (24 models). Set thinking=true for extended reasoning. Costs credit ($5 free per wallet).",
    inputSchema: {
      type: "object",
      properties: {
        wallet: { type: "string" },
        model: { type: "string", description: "e.g. openai/gpt-6-astra, anthropic/..., glm/glm-5.3-flash (cheapest)" },
        thinking: { type: "boolean", description: "Extended reasoning pass (uses more tokens)" },
        messages: { type: "array", items: { type: "object", properties: { role: { type: "string" }, content: { type: "string" } } } },
      },
      required: ["messages"],
    },
  },
  { name: "get_credits", description: "Inference credit balance (granted/used/remaining) for a wallet.", inputSchema: { type: "object", properties: { wallet: { type: "string" } }, required: ["wallet"] } },
  {
    name: "memory_retain",
    description: "Store a durable memory note for a wallet/bank. Deduped — identical content is skipped. Persists across sessions.",
    inputSchema: { type: "object", properties: { bank_id: { type: "string", description: "Wallet address or bank id" }, content: { type: "string", description: "Max 4000 chars" }, title: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["bank_id", "content"] },
  },
  {
    name: "memory_recall",
    description: "Recall memory notes for a wallet/bank, scored by recency-decay match.",
    inputSchema: { type: "object", properties: { bank_id: { type: "string" }, query: { type: "string" }, limit: { type: "number" } }, required: ["bank_id", "query"] },
  },
  {
    name: "create_key",
    description: "Create a cluster API key (clst_...) for a wallet. Shown exactly once.",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, name: { type: "string" }, session_token: { type: "string" }, signature: { type: "string" } }, required: ["wallet"] },
  },
  { name: "key_usage", description: "Metered usage for a wallet's keys: requests, tokens, USD.", inputSchema: { type: "object", properties: { wallet: { type: "string" }, session_token: { type: "string" }, signature: { type: "string" } }, required: ["wallet"] } },
{
    name: "token_safety",
    description: "Safety scan for a Robinhood Chain token: liquidity depth, buy/sell ratio honeypot heuristic, holder count via explorer, launchpad-factory detection. Returns score, tier, flags.",
    inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  },
  {
    name: "compare_tokens",
    description: "Side-by-side token comparison: price, 24h change, liquidity, volume for 2+ tokens (stocks or crypto).",
    inputSchema: { type: "object", properties: { symbols: { type: "string", description: "Comma-separated, e.g. 'NVDA,PONS'" } }, required: ["symbols"] },
  },
  { name: "sector_heat", description: "Sector heat: average day change, advancers/decliners per sector across the universe.", inputSchema: { type: "object", properties: {} } },
  { name: "agent_list", description: "The 16 cluster agent capabilities: Relay, Scout, Argus, Vault, Oracle, ... with categories and triggers.", inputSchema: { type: "object", properties: {} } },
  {
    name: "agent_run",
    description: "Log an agent capability interaction for a wallet (audit trail; post-$CLST-launch these feed the payout mechanism).",
    inputSchema: { type: "object", properties: { agent_id: { type: "string" }, wallet: { type: "string" }, label: { type: "string" }, session_token: { type: "string" }, signature: { type: "string" } }, required: ["agent_id"] },
  },
  {
    name: "get_position",
    description: "Wallet's index position: $CLST balance read on-chain (honest zeros pre-launch).",
    inputSchema: { type: "object", properties: { wallet: { type: "string" } }, required: ["wallet"] },
  },
  {
    name: "get_portfolio",
    description: "Portfolio view + history for a wallet (wallet-auth required).",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, session_token: { type: "string" }, signature: { type: "string" } }, required: ["wallet"] },
  },
  {
    name: "list_conversations",
    description: "Chat conversation list for a wallet (wallet-auth required — titles are private).",
    inputSchema: { type: "object", properties: { wallet: { type: "string" }, session_token: { type: "string" }, signature: { type: "string" } }, required: ["wallet"] },
  },
  {
    name: "agent_quotes",
    description: "Real quotes for every agent that has a market analogue (mapped symbols). No-auth market data.",
    inputSchema: { type: "object", properties: {} },
  },
  { name: "token_info", description: "Token metadata on-chain: symbol, decimals, total supply for any 4663 address.", inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] } },
  { name: "social_profile", description: "X (Twitter) link status for a wallet.", inputSchema: { type: "object", properties: { wallet: { type: "string" } }, required: ["wallet"] } },
  { name: "memory_consolidate", description: "Two-pass memory consolidation: recall fragments, LLM synthesizes, retain the summary. Reduces note bloat.", inputSchema: { type: "object", properties: { bank_id: { type: "string" }, session_token: { type: "string" }, signature: { type: "string" } }, required: ["bank_id"] } },
  {
    name: "dca_preview",
    description: "DCA plan calculator (dry-run, no txs): quote N buys of X ETH each into a token, returns per-buy expected amounts + total at current prices. Real execution = sign each buy with your wallet (see skills/swap).",
    inputSchema: { type: "object", properties: { token: { type: "string" }, eth_per_buy: { type: "string", description: "e.g. '0.01'" }, buys: { type: "number" } }, required: ["token", "eth_per_buy", "buys"] },
  },
  {
    name: "tpsl_preview",
    description: "Bracket preview for a held token: current price from DexScreener, suggested TP/SL offsets (±10/20%), and the sell-side quote at those levels. Dry-run — no orders stored.",
    inputSchema: { type: "object", properties: { token: { type: "string" }, amount_tokens: { type: "string", description: " wei" }, tp_pct: { type: "number" }, sl_pct: { type: "number" } }, required: ["token", "amount_tokens"] },
  },
  {
    name: "wallet_value",
    description: "USD valuation of a wallet: on-chain balances × live quotes, with concentration breakdown.",
    inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  },
  {
    name: "basket_vs_wallet",
    description: "Compare a wallet's holdings against the 19-name payout basket: which basket names are missing, overweight, underweight.",
    inputSchema: { type: "object", properties: { address: { type: "string" } }, required: ["address"] },
  },
  {
    name: "news_for_symbol",
    description: "Headlines filtered for relevance to one symbol's sector/company.",
    inputSchema: { type: "object", properties: { symbol: { type: "string" }, limit: { type: "number" } }, required: ["symbol"] },
  },
  {
    name: "gas_now",
    description: "Current gas price + ETH USD on 4663 (from trade status).",
    inputSchema: { type: "object", properties: {} },
  },

];

const server = new Server({ name: "cluster", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "get_quotes":
        return json(await api(`/api/market/quotes?symbols=${encodeURIComponent(args.symbols)}`));
      case "get_movers":
        return json(await api(`/api/market/movers?limit=${args.limit ?? 10}`));
      case "get_news":
        return json(await api(`/api/market/news?limit=${args.limit ?? 12}`));
      case "get_chart":
        return json(await api(`/api/market/chart/${encodeURIComponent(args.symbol)}?tf=${args.tf ?? "1mo"}`));
      case "get_index":
        return json(await api("/api/index"));
      case "get_payout_basket":
        return json(await api("/api/index/payout-basket"));
      case "get_distributions":
        return json(await api("/api/distributions"));
      case "quote_swap": {
        const qs = new URLSearchParams({ token: args.token, side: args.side ?? "buy", amount: args.amount });
        if (args.via) qs.set("via", args.via);
        return json(await api(`/api/trade/quote?${qs}`));
      }
      case "trade_status":
        return json(await api("/api/trade/status"));
      case "wallet_balances":
        return json(await api(`/api/trade/wallet/${args.address}`));
      case "get_models":
        return json(await api("/api/chat/models"));
      case "get_credits":
        return json(await api(`/api/chat/credits?wallet=${encodeURIComponent(args.wallet)}`));
      case "chat": {
        const w = walletArgs(args);
        return json(
          await api("/api/chat", {
            method: "POST",
            body: {
              wallet: w.wallet,
              session_token: w.session_token,
              signature: w.signature,
              model: args.model ?? "glm/glm-5.3-flash",
              thinking: args.thinking ?? false,
              messages: args.messages,
            },
          }),
        );
      }
      case "memory_retain": {
        const w = walletArgs(args);
        return json(
          await api("/api/memory/retain", {
            method: "POST",
            body: { bank_id: w.wallet, wallet: w.wallet, session_token: w.session_token, signature: w.signature, content: args.content, title: args.title, tags: args.tags },
          }),
        );
      }
      case "memory_recall": {
        const w = walletArgs(args);
        return json(
          await api("/api/memory/recall", {
            method: "POST",
            body: { bank_id: w.wallet, wallet: w.wallet, session_token: w.session_token, signature: w.signature, query: args.query, limit: args.limit ?? 10 },
          }),
        );
      }
      case "create_key": {
        const w = walletArgs(args);
        return json(await api("/api/keys", { method: "POST", body: { wallet: w.wallet, session_token: w.session_token, signature: w.signature, name: args.name ?? "default" } }));
      }
      case "key_usage": {
        const w = walletArgs(args);
        return json(await api(`/api/keys/usage?wallet=${encodeURIComponent(w.wallet)}&session_token=${encodeURIComponent(w.session_token ?? "")}&signature=${encodeURIComponent(w.signature ?? "")}`));
      }
      case "token_safety": {
        // Honeypot + liquidity heuristic (pattern: finchagentic checkTokenSafety)
        const pairs = await api(`/api/market/quote/${args.address}`).catch(() => null);
        const dex = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${args.address}`)
          .then((r) => r.json()).catch(() => null);
        const chainPairs = (dex?.pairs ?? []).filter((p) => p.chainId === "robinhood");
        const totalLiq = chainPairs.reduce((s, p) => s + (parseFloat(p.liquidity?.usd ?? "0") || 0), 0);
        const buys = chainPairs.reduce((s, p) => s + (p.txns?.h24?.buys ?? 0), 0);
        const sells = chainPairs.reduce((s, p) => s + (p.txns?.h24?.sells ?? 0), 0);
        const flags = [];
        let score = 0;
        if (totalLiq < 1000) { score += 30; flags.push("🔴 Very low liquidity (<$1k)"); }
        else if (totalLiq < 25000) { score += 12; flags.push(`🟠 Thin liquidity ($${Math.round(totalLiq).toLocaleString()})`); }
        else flags.push(`🟢 Liquidity: $${totalLiq >= 1e6 ? (totalLiq / 1e6).toFixed(1) + "M" : Math.round(totalLiq).toLocaleString()}`);
        if (buys > 10 && sells === 0) { score += 40; flags.push("🔴 Honeypot heuristic: buys with ZERO sells in 24h"); }
        else flags.push(`🟢 Two-way flow: ${buys} buys / ${sells} sells (24h)`);
        const tier = score >= 40 ? "HIGH RISK" : score >= 15 ? "CAUTION" : "OK";
        const best = chainPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        return json({ address: args.address, score, tier, flags,
          liquidity_usd: totalLiq, buys_24h: buys, sells_24h: sells,
          price_usd: best?.priceUsd ?? null,
          dex_url: best ? `https://dexscreener.com/robinhood/${best.pairAddress}` : null,
          note: "Heuristic only — not an audit. Always verify the contract source." });
      }
      case "compare_tokens": {
        const syms = String(args.symbols).split(",").map((s) => s.trim()).filter(Boolean);
        return json(await api(`/api/market/quotes?symbols=${encodeURIComponent(syms.join(","))}`));
      }
      case "sector_heat":
        return json(await api("/api/market/sectors"));
      case "agent_list":
        return json(await api("/api/agents"));
      case "agent_run": {
        const w = walletArgs(args);
        return json(await api("/api/runs", { method: "POST", body: {
          agent_id: args.agent_id, wallet: w.wallet, label: args.label,
          session_token: w.session_token, signature: w.signature,
        }}));
      }
      case "get_position":
        return json(await api(`/api/index/position?wallet=${encodeURIComponent(args.wallet)}`));
      case "get_portfolio": {
        const w = walletArgs(args);
        return json(await api(`/api/portfolio?wallet=${encodeURIComponent(w.wallet)}&session_token=${encodeURIComponent(w.session_token ?? "")}&signature=${encodeURIComponent(w.signature ?? "")}`));
      }
      case "list_conversations": {
        const w = walletArgs(args);
        return json(await api(`/api/chat/conversations?wallet=${encodeURIComponent(w.wallet)}&session_token=${encodeURIComponent(w.session_token ?? "")}&signature=${encodeURIComponent(w.signature ?? "")}`));
      }
      case "agent_quotes": {
        const basket = await api("/api/index/payout-basket");
        const names = (basket?.basket ?? []).map((x) => x.symbol ?? x).join(",");
        return json(await api(`/api/market/quotes?symbols=${encodeURIComponent(names)}`));
      }
      case "token_info":
        return json(await api(`/api/trade/token/${args.address}`));
      case "social_profile":
        return json(await api(`/api/social/profile?wallet=${encodeURIComponent(args.wallet)}`));
      case "memory_consolidate": {
        const w = walletArgs(args);
        return json(await api("/api/memory/consolidate", { method: "POST", body: {
          bank_id: w.wallet, wallet: w.wallet, session_token: w.session_token, signature: w.signature,
        }}));
      }
      case "dca_preview": {
        const wei = Math.floor(parseFloat(args.eth_per_buy) * 1e18);
        const out = [];
        let total = 0;
        for (let k = 0; k < Math.min(args.buys ?? 4, 10); k++) {
          const q = await api(`/api/trade/quote?token=${args.token}&side=buy&amount=${wei}`);
          const amt = q?.amountOut ? Number(BigInt(q.amountOut)) / 1e18 : null;
          out.push({ buy: k + 1, ok: q?.ok ?? false, label: q?.label, expected_tokens: amt });
          if (amt) total += amt;
        }
        return json({ token: args.token, eth_per_buy: args.eth_per_buy, buys: out, total_expected_tokens: total, note: "Dry-run preview at current prices. Real execution signs each buy with your wallet." });
      }
      case "tpsl_preview": {
        const dex = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${args.token}`)
          .then((r) => r.json()).catch(() => null);
        const pairs = (dex?.pairs ?? []).filter((p) => p.chainId === "robinhood");
        const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        const px = best?.priceUsd ? Number(best.priceUsd) : null;
        if (px == null) return err("No price data for this token");
        const amt = Number(BigInt(args.amount_tokens)) / 1e18;
        const usd = amt * px;
        const tp = args.tp_pct ?? 20, sl = args.sl_pct ?? 10;
        return json({ token: args.token, amount_tokens: amt, price_usd: px, position_usd: usd,
          take_profit: { pct: tp, target_price: px * (1 + tp / 100), value_usd: usd * (1 + tp / 100) },
          stop_loss: { pct: sl, target_price: px * (1 - sl / 100), value_usd: usd * (1 - sl / 100) },
          note: "Dry-run preview. Execute by watching price and swapping via quote_swap." });
      }
      case "wallet_value": {
        const w = await api(`/api/trade/wallet/${args.address}`);
        const st = await api("/api/trade/status");
        const ethUsd = st?.eth_usd ?? null;
        const holdings = (w?.tokens ?? w?.balances ?? []).map((t) => ({ ...t }));
        return json({ address: args.address, native_eth: w?.eth ?? w?.native_eth, eth_usd: ethUsd, holdings, note: "USD per token requires quotes — call get_quotes for held symbols." });
      }
      case "basket_vs_wallet": {
        const basket = await api("/api/index/payout-basket");
        const w = await api(`/api/trade/wallet/${args.address}`);
        const names = (basket?.basket ?? []).map((x) => x.symbol ?? x);
        const held = new Set((w?.tokens ?? []).map((t) => (t.symbol ?? "").toUpperCase()));
        return json({ basket: names, held: [...held], missing: names.filter((n) => !held.has(n)), overlap: names.filter((n) => held.has(n)) });
      }
      case "news_for_symbol": {
        const news = await api(`/api/market/news?limit=${args.limit ?? 30}`);
        const sym = String(args.symbol).toUpperCase();
        const items = (news?.items ?? []).filter((n) => (n.title ?? "").toUpperCase().includes(sym));
        return json({ symbol: sym, items: items.slice(0, args.limit ?? 10), total_scanned: (news?.items ?? []).length });
      }
      case "gas_now": {
        const st = await api("/api/trade/status");
        return json({ gas_gwei: st?.gas_price_gwei, eth_usd: st?.eth_usd, chain_id: st?.chain_id });
      }
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(e.message ?? String(e));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`cluster-mcp ready — API: ${API}`);
