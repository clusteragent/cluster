#!/usr/bin/env node
/**
 * AGENTINDEX BOT — treasury auto-buy + holder distribution. NO SMART CONTRACTS.
 * Everything runs from plain wallets (EOA): treasury receives fees -> bot
 * buys the stock basket on Uniswap V4 (via the verified UniversalRouter
 * fork) -> bot drips pro-rata ERC-20 transfers to eligible $CLST holders.
 *
 * USAGE:
 *   node bot/cluster-bot.mjs --selftest          # read-only end-to-end, no writes, no spend
 *   node bot/cluster-bot.mjs                     # daemon, DRY (plans + state file, never signs)
 *   node bot/cluster-bot.mjs --confirm-real-money  # LIVE: signs real txs (needs TREASURY_PRIVATE_KEY)
 *
 * SAFETY MODEL (mirrors PonsFees distribute-bot, minus any contract layer):
 *   - Default is DRY: without --confirm-real-money the bot NEVER imports a
 *     key, NEVER signs, NEVER sends. It only reads chain + writes state JSON.
 *   - Distribution legs are plain ERC-20 transfers from a wallet that already
 *     holds the tokens — no per-leg eth_call simulate (that was the slow
 *     part; a transfer with sufficient balance essentially never reverts).
 *     The batch still stops on the first confirmed failure.
 *   - V4 swap routes are derived ONCE per hour and cached (keccak pool-key
 *     verified against DexScreener poolIds — cryptographically checked, not
 *     assumed), so a pass doesn't re-derive 20x fetches every time.
 *   - Distribution is FEES-BASED (no cycles): every pass, if the basket has
 *     real value it gets pushed pro-rata; lastDistributeAt timestamp is
 *     persisted in state — restarts can't double-send.
 *   - Gas reserve is never touched; treasury key stays in gitignored .env.
 *
 * CONFIG (.env at repo root, gitignored):
 *   TREASURY_PRIVATE_KEY=0x…   # only read when --confirm-real-money
 *   RH_RPC_URL=…               # default: Alchemy robinhood-mainnet
 */
import { readFileSync, existsSync, writeFileSync, renameSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOT_DIR = resolve(ROOT, "bot");
const STATE_PATH = resolve(BOT_DIR, "state.json");
const ROUTES_CACHE_PATH = resolve(BOT_DIR, "routes-cache.json");
const EOA_CACHE_PATH = resolve(BOT_DIR, "eoa-cache.json");

function loadEnv() {
  const p = resolve(ROOT, ".env");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = { ...loadEnv(), ...process.env };
const args = process.argv.slice(2);
const LIVE = args.includes("--confirm-real-money");
const SELFTEST = args.includes("--selftest");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const RH_RPC = env.RH_RPC_URL || "https://robinhood-mainnet.g.alchemy.com/v2/alch_44Lcf9rzPsS0A0D9C9xGX";
const RH_BLOCKSCOUT = "https://robinhoodchain.blockscout.com";
const BS_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168"; // 6 decimals
const TREASURY = (env.TREASURY_ADDRESS || "0xCdfC408f56f3d5744284015b4C5E01aB7cca8827").toLowerCase();

// --- CA GUARD (owner instruction 2026-09-06): new project — the token CA has
// not been issued yet. Until the owner drops the real CA into bot/ca.txt, the
// bot must NOT buy stock and NOT send anything to holders. It keeps watching
// the chain and publishing the feed (read-only), but every outbound path is
// blocked. Holder list is derived from the CA the same way PonsFees does it:
// Blockscout /api/v2/tokens/<CA>/holders, EOA-only.
const CA_FILE = resolve(BOT_DIR, "ca.txt");
function readCa() {
  try {
    const m = readFileSync(CA_FILE, "utf8").trim().match(/0x[0-9a-fA-F]{40}/);
    return m ? m[0].toLowerCase() : null;
  } catch { return null; }
}
let KUMO = readCa();             // $CLST CA — null until launch → bot stays in fees-accumulate mode
let provider = null;  // set in main(), used by eligibleHolders()
// Hot-reload: every daemon pass re-checks bot/ca.txt, so dropping the real CA
// in the file flips the bot live within 60s — no restart, no downtime.
function reloadCa() {
  if (KUMO) return false;
  const c = readCa();
  if (c) { KUMO = c; console.log(`CA DETECTED → ${c} — distribution unlocked, next cycle sends live`); return true; }
  return false;
}
const ROUTER = "0x8876789976dEcBfCbBbe364623C63652db8C0904"; // verified RH fork of UniversalRouter
const HOOKS_ZERO = "0x0000000000000000000000000000000000000000";

// Owner 2026-09-07 (stockdivvy sync): buy leaves 0.03 ETH — that float is the
// distribution gas budget. ETH below 0.03 = gas only, never spent on stock.
const GAS_RESERVE_ETH = Number(env.GAS_RESERVE_ETH || 0.01);
const BUY_MIN_ETH = 0.002;         // deploy only when spendable >= this (avoid dust cycles)
const BUY_MIN_INTERVAL_MS = 10 * 60 * 1000; // at most one buy push per 10 min
// Distribution is FEES-BASED (owner 2026-09-07: "hapus timer next cycle, gw mau
// itu ke ponsfees aja, gada cycle2an") — no fixed windows. Every daemon pass
// checks the basket: fees came in → vault bought → basket has real value →
// distribute it. DIST_MIN_INTERVAL_MINUTES is only an RPC/gas throttle.
const DIST_MIN_INTERVAL_MS = Number(env.DIST_MIN_INTERVAL_MINUTES || 1) * 60_000;
const DUST_USD = Number(env.DUST_USD || 0.01); // skip per-holder legs below this — owner: "yg kecil gausah dikirim"
const MIN_STOCK_USD = Number(env.MIN_STOCK_USD || 1.00); // skip entire stock if its total basket value < $1 — owner: "kalau satu stock value $1 skip, yg $2 tetep kirim"
const MIN_ROUND_USD = Number(env.MIN_ROUND_USD || 1); // owner 2026-09-08: stop only when ALL stocks are below $1 threshold
const SLIPPAGE_BPS = 300;          // 3%
const ETH_FALLBACK_USD = 3200;
const TICK_MS = 60_000;            // daemon poll
const ROUTE_TTL_MS = 3600_1000;    // re-derive routes hourly

// Basket: 15 original names + QQQ/SPY/GLD (official Robinhood Tokens,
// addresses verified on Blockscout 2026-09-06). Weights sum to 100.
const STOCKS = {
  AAPL: "0xaf3d76f1834a1d425780943c99ea8a608f8a93f9",
  AMD: "0x86923f96303d656e4aa86d9d42d1e57ad2023fdc",
  AMZN: "0x12f190a9f9d7d37a250758b26824b97ce941bf54",
  COIN: "0x6330d8c3178a418788df01a47479c0ce7ccf450b",
  GOOGL: "0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3",
  INTC: "0xc72b96e0e48ecd4dc75e1e45396e26300bc39681",
  META: "0xc0d6457c16cc70d6790dd43521c899c87ce02f35",
  MSFT: "0xe93237c50d904957cf27e7b1133b510c669c2e74",
  MU: "0xff080c8ce2e5feadaca0da81314ae59d232d4afd",
  NVDA: "0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec",
  PLTR: "0x894e1ec2d74ffe5aef8dc8a9e84686accb964f2a",
  SNDK: "0xb90a19ff0af67f7779aff50a882a9cff42446400",
  SPCX: "0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea",
  TSLA: "0x322f0929c4625ed5bad873c95208d54e1c003b2d",
  USAR: "0xd917b029c761d264c6a312bbbcda868658ef86a6",
  QQQ: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68",
  SPY: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C",
  GLD: "0xC9a981FEE1F9DEc688bb123ccDeCc63D0deBFC4e",
};
const DECIMALS = {}; // every Robinhood Token is 18; USDG is 6
for (const s of Object.keys(STOCKS)) DECIMALS[s] = 18;
DECIMALS.USDG = 6;

const WEIGHTS = {
  NVDA: 12.0, AAPL: 10.0, MSFT: 9.0, AMZN: 7.5, GOOGL: 6.5, META: 6.0,
  TSLA: 5.5, AMD: 4.5, COIN: 3.0, PLTR: 3.0, INTC: 2.5, MU: 2.5,
  SPCX: 1.5, SNDK: 1.0, USAR: 1.0,
  QQQ: 12.0, SPY: 10.0, GLD: 5.0,
};

// Not end-holders (PonsFees-style exclusion): dead addresses, the token
// contract itself, and the treasury. Plus a concentration cap — any single
// holder above MAX_HOLDER_SHARE_PCT of supply is treated as LP/bonding-curve/
// locker and skipped (owner: "top 1 yg megang 40%> itu gausah dikirim").
const DEAD_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000001",
  TREASURY,
  "0x0c96169b45799533342020247748715627e7e509", // LP — owner: jgn dikirim stock
]);
const MAX_HOLDER_SHARE_PCT = 40; // % of supply; above = not a real holder

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function transfer(address to, uint256 amount) returns (bool)"];

// ---------------------------------------------------------------------------
// Tiny utilities (atomic write, json get with UA)
// ---------------------------------------------------------------------------
function writeJsonAtomic(p, obj) {
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(obj, null, 2));
  renameSync(tmp, p);
}
function readJsonSafe(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}
async function bsGet(path) {
  const res = await fetch(RH_BLOCKSCOUT + path, { headers: { "User-Agent": BS_UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`blockscout ${res.status} on ${path.split("?")[0]}`);
  return res.json();
}
const shortAddr = (a) => (a ? a.slice(0, 6) + "..." + a.slice(-4) : "?");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// RPC
// ---------------------------------------------------------------------------
async function rpc(method, params = []) {
  const res = await fetch(RH_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12_000),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message || JSON.stringify(j.error)}`);
  return j.result;
}
async function getBalanceEth() {
  try { return Number(BigInt(await rpc("eth_getBalance", [TREASURY, "latest"]))) / 1e18; }
  catch { return null; }
}
async function getEthPriceUsd() {
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", { signal: AbortSignal.timeout(10_000) });
    if (r.ok) { const d = await r.json(); if (d?.ethereum?.usd) return d.ethereum.usd; }
  } catch {}
  return ETH_FALLBACK_USD;
}

// ---------------------------------------------------------------------------
// V4 route derivation (keccak-verified) — ported from keeper, now CACHED.
// ---------------------------------------------------------------------------
const KECCAK_RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROT = [[0,36,3,41,18],[1,44,10,45,2],[62,6,43,15,61],[28,55,25,21,56],[27,20,39,8,14]];
function keccakF(state) {
  for (let r = 0; r < 24; r++) {
    const C = [], D = [];
    for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
    for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rotl(C[(x+1)%5], 1);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x+5*y] ^= D[x];
    const B = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y+5*((2*x+3*y)%5)] = rotl(state[x+5*y], ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x+5*y] = B[x+5*y] ^ ((~B[(x+1)%5+5*y]) & B[(x+2)%5+5*y]);
    state[0] ^= KECCAK_RC[r];
  }
  return state;
}
function rotl(x, n) { return ((x << BigInt(n)) | (x >> BigInt(64-n))) & 0xffffffffffffffffn; }
function keccak256Hex(inputBytes) {
  const rate = 136;
  const state = new Array(25).fill(0n);
  const block = [...inputBytes, 0x01];
  while (block.length % rate !== 0) block.push(0x00);
  block[block.length - 1] |= 0x80;
  for (let off = 0; off < block.length; off += rate) {
    for (let i = 0; i < rate; i++) {
      const lane = Math.floor(i / 8);
      state[lane] ^= BigInt(block[off + i]) << BigInt(8 * (i % 8));
    }
    keccakF(state);
  }
  const out = [];
  for (let i = 0; i < 4; i++) { const lane = state[i]; for (let b = 0; b < 8; b++) out.push(Number((lane >> BigInt(8*b)) & 0xffn)); }
  return "0x" + out.map((x) => x.toString(16).padStart(2, "0")).join("");
}
function v4PoolId(c0, c1, fee, tickSpacing, hooks) {
  const pad32 = (hex) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  const enc = Buffer.from(
    pad32(c0) + pad32(c1) + fee.toString(16).padStart(64, "0") +
    (tickSpacing < 0 ? (0x10000000000000000n + BigInt(tickSpacing)).toString(16) : tickSpacing.toString(16)).padStart(64, "0") +
    pad32(hooks), "hex");
  return keccak256Hex(enc);
}

async function deriveRoutesFresh() {
  const legs = Object.assign({ USDG: USDG }, STOCKS);
  const fees = [3000, 10000, 500, 100, 2500, 1250, 2000, 30000];
  const tsList = [60, 200, 10, 1, 120, 30];
  const verified = {};
  for (const [sym, tok] of Object.entries(legs)) {
    let pools = [];
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tok}`, {
        signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "Mozilla/5.0 (cluster-bot)" },
      });
      pools = ((await res.json()).pairs || []).filter((p) => (p.liquidity || {}).usd > 1000);
    } catch { continue; }
    for (const p of pools) {
      const qsym = (p.quoteToken || {}).symbol, bsym = (p.baseToken || {}).symbol;
      if (!(qsym === "USDG" || bsym === "USDG" || sym === "USDG")) continue;
      const other = sym === "USDG" ? (qsym === "USDG" ? p.baseToken.address : p.quoteToken.address) : p.quoteToken.address;
      const pid = (p.pairAddress || "").toLowerCase();
      if (!/^0x[0-9a-f]{64}$/.test(pid)) continue;
      let hit = false;
      for (const f of fees) for (const ts of tsList) for (const [c0, c1] of [[tok, other], [other, tok]]) {
        if (!hit && v4PoolId(c0, c1, f, ts, HOOKS_ZERO) === pid) {
          verified[sym] = { fee: f, tickSpacing: ts, other, liq: Math.round((p.liquidity || {}).usd), priceUsd: Number(p.priceUsd) };
          hit = true;
        }
      }
      if (hit) break;
    }
    await sleep(150);
  }
  return verified;
}

async function getRoutes({ log = false } = {}) {
  const cache = readJsonSafe(ROUTES_CACHE_PATH);
  if (cache && Date.now() - cache.ts < ROUTE_TTL_MS && Object.keys(cache.routes).length) {
    if (log) console.log(`  routes: ${Object.keys(cache.routes).length} legs (cached ${Math.round((Date.now() - cache.ts) / 60000)}m ago)`);
    return cache.routes;
  }
  if (log) console.log("  deriving V4 routes (keccak pool-key verification)...");
  const routes = await deriveRoutesFresh();
  writeJsonAtomic(ROUTES_CACHE_PATH, { ts: Date.now(), routes });
  if (log) console.log(`  routes: ${Object.keys(routes).length}/${Object.keys(STOCKS).length + 1} legs verified, cached 1h`);
  return routes;
}

// ---------------------------------------------------------------------------
// Holders: Blockscout $CLST holders, EOA-only (cached), exclude curve+locker.
// ---------------------------------------------------------------------------
async function fetchClusterHolders() {
  const raw = [];
  let params = "";
  for (let page = 0; page < 20; page++) {
    try {
      const json = await bsGet(`/api/v2/tokens/${KUMO}/holders${params ? "?" + params : ""}`);
      for (const item of json.items || []) raw.push({ address: item.address.hash, balance: BigInt(item.value) });
      if (!json.next_page_params) break;
      params = new URLSearchParams(json.next_page_params).toString();
      await sleep(120);
    } catch (e) {
      console.error(`  holders: page ${page} failed (${e.message}), continuing with ${raw.length}`);
      break;
    }
  }
  return raw.filter((h) => !DEAD_ADDRESSES.has(h.address.toLowerCase()) && h.balance > 0n);
}

async function filterEoas(addrs) {
  const cache = readJsonSafe(EOA_CACHE_PATH) || {};
  let changed = false;
  for (const a of addrs) {
    const k = a.toLowerCase();
    if (k in cache) continue;
    try {
      const j = await bsGet(`/api/v2/addresses/${a}`);
      cache[k] = j.is_smart_contract !== true;
      changed = true;
    } catch { cache[k] = true; } // fail-open: unknown keeps eligibility
    await sleep(80);
  }
  if (changed) writeJsonAtomic(EOA_CACHE_PATH, cache);
  return addrs.filter((a) => cache[a.toLowerCase()] !== false);
}

async function eligibleHolders() {
  // ALWAYS fresh scan — owner 2026-09-07: "setiap distri scan dulu, gapake yang
  // lama". Blockscout holders endpoint is queried live every cycle, no cache.
  const raw = await fetchClusterHolders();
  // total supply straight from the contract (PonsFees-style: filter on real chain data)
  let supply = 1_000_000_000n * 10n ** 18n;
  try {
    const erc = new ethers.Contract(KUMO, ["function totalSupply() view returns (uint256)"], provider);
    supply = await erc.totalSupply();
  } catch { /* keep default; cap check still runs against it */ }
  const eoas = await filterEoas(raw.map((h) => h.address));
  const set = new Set(eoas.map((a) => a.toLowerCase()));
  const out = [];
  let skippedWhale = 0;
  let skippedZero = 0;
  // REAL-TIME VALIDATION: check balanceOf on-chain for every holder before sending.
  // Blockscout can lag (holder sold tokens) — don't send to someone who holds 0.
  const erc = new ethers.Contract(KUMO, ["function balanceOf(address) view returns (uint256)"], provider);
  for (const h of raw) {
    const a = h.address.toLowerCase();
    if (!set.has(a)) continue;
    if (DEAD_ADDRESSES.has(a)) continue;
    if (h.balance * 100n > supply * BigInt(MAX_HOLDER_SHARE_PCT)) { skippedWhale++; continue; }
    let realBal;
    try { realBal = await erc.balanceOf(h.address); } catch { continue; }
    if (realBal === 0n) { skippedZero++; continue; }
    out.push({ address: h.address, balance: Number(realBal) / 1e18 });
    await sleep(20);
  }
  if (skippedWhale) console.log(`  holders: skipped ${skippedWhale} whale(s) >${MAX_HOLDER_SHARE_PCT}% (LP/curve/locker guard)`);
  if (skippedZero) console.log(`  holders: skipped ${skippedZero} wallet(s) with 0 real balance (sold/transferred out)`);
  console.log(`  holders: ${out.length} REAL holders verified on-chain`);
  return out;
}

// ---------------------------------------------------------------------------
// Swap calldata (ETH -> USDG -> STOCK, fork-exact encoding from keeper)
// ---------------------------------------------------------------------------
const PATH_KEY_TYPE = "tuple(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)";
const EXACT_INPUT_PARAMS_TYPE = `tuple(address currencyIn,${PATH_KEY_TYPE}[] path,uint256[] minHopPriceX36,uint128 amountIn,uint128 amountOutMinimum)`;
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

function buildSwapCalldata(sym, amountInWei, amountOutMinimum, routes) {
  const usdgLeg = routes.USDG, stockLeg = routes[sym];
  if (!usdgLeg || !stockLeg) throw new Error(`${sym}: no verified route`);
  const path = [
    { intermediateCurrency: USDG, fee: usdgLeg.fee, tickSpacing: usdgLeg.tickSpacing, hooks: HOOKS_ZERO, hookData: "0x" },
    { intermediateCurrency: STOCKS[sym], fee: stockLeg.fee, tickSpacing: stockLeg.tickSpacing, hooks: HOOKS_ZERO, hookData: "0x" },
  ];
  const exactInputParams = abiCoder.encode([EXACT_INPUT_PARAMS_TYPE],
    [[ethers.ZeroAddress, path.map((p) => [p.intermediateCurrency, p.fee, p.tickSpacing, p.hooks, p.hookData]), [0n, 0n], amountInWei, amountOutMinimum]]);
  const settleAll = abiCoder.encode(["address", "uint256"], [ethers.ZeroAddress, amountInWei]);
  const takeAll = abiCoder.encode(["address", "uint256"], [STOCKS[sym], amountOutMinimum]);
  const actions = ethers.solidityPacked(["uint8", "uint8", "uint8"], [0x07, 0x0c, 0x0f]);
  const v4SwapInput = abiCoder.encode(["bytes", "bytes[]"], [actions, [exactInputParams, settleAll, takeAll]]);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const data = new ethers.Interface(["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"])
    .encodeFunctionData("execute", ["0x10", [v4SwapInput], deadline]);
  return { to: ROUTER, value: amountInWei, data };
}

function referenceMinOut(sym, amountInWei, ethUsd, priceUsd) {
  const usdIn = Number(ethers.formatEther(amountInWei)) * ethUsd;
  const minTokens = (usdIn / priceUsd) * (1 - SLIPPAGE_BPS / 10_000);
  return ethers.parseUnits(minTokens.toFixed(DECIMALS[sym]), DECIMALS[sym]);
}

// ---------------------------------------------------------------------------
// Bounded confirm (from keeper: never hang forever on a stalled RPC)
// ---------------------------------------------------------------------------
async function sendAndConfirm(wallet, provider, tx, { timeoutMs = 90_000, pollAttempts = 5, pollIntervalMs = 10_000 } = {}) {
  const sent = await wallet.sendTransaction(tx);
  let receipt;
  try {
    receipt = await Promise.race([
      sent.wait(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error("wait() timeout")), timeoutMs)),
    ]);
  } catch {
    for (let i = 0; i < pollAttempts && !receipt; i++) {
      await sleep(pollIntervalMs);
      receipt = await provider.getTransactionReceipt(sent.hash).catch(() => null);
    }
    if (!receipt) throw new Error(`${sent.hash} unconfirmed after timeout — stopping batch, not firing blind.`);
  }
  return { sent, receipt };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function loadState() {
  return readJsonAtomicSafe() || {
    startedAt: new Date().toISOString(),
    lastBuyAt: 0, buys: [],
    lastDistributeAt: 0, distributions: [],
    totals: { buysUsd: 0, distributedUsd: 0, distributions: 0 },
  };
}
function readJsonAtomicSafe() { return readJsonSafe(STATE_PATH); }

// --- publish the compact snapshot to the public data repo (raw.githubusercontent
// feed the web panel reads — same idea as PonsFees' auto-committed
// distribution-latest.json, but via the Contents API so no local clone is needed)
const DATA_REPO = env.AGENTINDEX_DATA_REPO || "rimurucook/cluster-data";
let lastPublishedHash = null;
let lastPublishedAt = 0;
async function publishToDataRepo(snapshot) {
  const token = env.AGENTINDEX_DATA_TOKEN || (existsSync("/root/.cluster-data-token") ? readFileSync("/root/.cluster-data-token", "utf8").trim() : null);
  if (!token) return; // publishing is best-effort; bot keeps running without it
  if (Date.now() - lastPublishedAt < 55_000) return; // throttle: max 1 push / ~min (realtime feed — stockdivvy sync)
  try {
    const body = JSON.stringify(snapshot);
    const hdr = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "cluster-bot", "X-GitHub-Api-Version": "2022-11-28" };
    let sha = null;
    const cur = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/latest.json`, { headers: hdr, signal: AbortSignal.timeout(15_000) });
    if (cur.ok) sha = (await cur.json()).sha;
    const putBody = (sha) => JSON.stringify({ message: `bot: ${snapshot.mode} update ${snapshot.updatedAt}`, content: Buffer.from(body).toString("base64"), sha });
    let res = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/latest.json`, {
      method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
      body: putBody(sha),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 409) { // someone else pushed meanwhile — re-read sha and retry once
      const cur2 = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/latest.json`, { headers: hdr, signal: AbortSignal.timeout(15_000) });
      const sha2 = cur2.ok ? (await cur2.json()).sha : undefined;
      res = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/latest.json`, {
        method: "PUT", headers: { ...hdr, "Content-Type": "application/json" },
        body: putBody(sha2), signal: AbortSignal.timeout(20_000),
      });
    }
    if (res.ok) { lastPublishedHash = (await res.json()).commit?.sha; lastPublishedAt = Date.now(); }
    else console.error(`  publish: GitHub ${res.status}`);
  } catch (e) { console.error(`  publish error: ${e.message.slice(0, 80)}`); }
}

function saveState(st) {
  st.updatedAt = new Date().toISOString();
  writeJsonAtomic(STATE_PATH, st);
  // also publish a compact snapshot for the web panel (stockdivvy sync: rich
  // feed — payroll/history/meta/priceHistory so the web needs NO database)
  const snapshot = {
    updatedAt: st.updatedAt,
    mode: LIVE ? "live" : "dry",
    treasury: st.treasury,
    lastBuyAt: st.lastBuyAt,
    lastDistributeAt: st.lastDistributeAt,
    totals: st.totals,
    recentBuys: st.buys.slice(-12),
    recentDistributions: st.distributions.slice(-12),
    distributionHistory: st.distributions.map((d) => ({ at: d.at, usd: d.usd, transfers: d.transfers, recipientsCount: d.recipientsCount || 0 })),
    buyHistory: st.buys.map((b) => ({ at: b.at, usd: b.usd, eth: b.eth, legs: b.legs })),
    meta: st.meta || null,
    priceHistory: (st.priceHistory || []).slice(-48),
    payroll: Object.values(st.payroll || {})
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 100),
    payrollCount: Object.keys(st.payroll || {}).length,
  };
  writeJsonAtomic(resolve(BOT_DIR, "latest.json"), snapshot);
  pendingPublish = publishToDataRepo(snapshot); // fire-and-forget; awaited on exit
}
let pendingPublish = Promise.resolve();

// ---------------------------------------------------------------------------
// Cycle: BUY — deploy spendable ETH into the basket
// ---------------------------------------------------------------------------
async function runBuy(wallet, provider, st) {
  // Owner instruction 2026-09-06: buying stock with incoming ETH is ALLOWED even
  // before CA — only outbound distribution waits for the CA + eligibility check.
  const routes = await getRoutes({ log: true });
  const ethUsd = await getEthPriceUsd();
  const balance = await getBalanceEth();
  if (balance == null) { console.log("BUY: treasury balance unreadable — skip"); return; }
  const spendable = balance - GAS_RESERVE_ETH;
  if (spendable < BUY_MIN_ETH) { console.log(`BUY: spendable ${spendable.toFixed(6)} ETH < min ${BUY_MIN_ETH} — waiting`); return; }

  const tradable = Object.keys(WEIGHTS).filter((s) => routes[s] && routes[s].priceUsd > 0);
  const wSum = tradable.reduce((s, x) => s + WEIGHTS[x], 0);
  const totalWei = ethers.parseEther(spendable.toFixed(12));
  console.log(`BUY: deploying ${spendable.toFixed(6)} ETH (~$${(spendable * ethUsd).toFixed(2)}) across ${tradable.length}/${Object.keys(WEIGHTS).length} legs`);

  const legs = [];
  for (const sym of tradable) {
    const share = WEIGHTS[sym] / wSum;
    const amountInWei = (totalWei * BigInt(Math.round(share * 1e6))) / 1_000_000n;
    if (amountInWei === 0n) continue;
    const minOut = referenceMinOut(sym, amountInWei, ethUsd, routes[sym].priceUsd);
    legs.push({ sym, amountInWei, minOut, tx: buildSwapCalldata(sym, amountInWei, minOut, routes) });
  }

  const bought = [];
  let usdSpent = 0;
  for (const leg of legs) {
    if (!LIVE) {
      console.log(`  [dry] ${leg.sym.padEnd(5)} in=${ethers.formatEther(leg.amountInWei)} ETH (~$${(Number(ethers.formatEther(leg.amountInWei)) * ethUsd).toFixed(2)})`);
      bought.push({ sym: leg.sym, eth: Number(ethers.formatEther(leg.amountInWei)) });
      usdSpent += Number(ethers.formatEther(leg.amountInWei)) * ethUsd;
      continue;
    }
    try {
      const { sent, receipt } = await sendAndConfirm(wallet, provider, leg.tx);
      const eth = Number(ethers.formatEther(leg.amountInWei));
      console.log(`  ${leg.sym.padEnd(5)} ${receipt.status === 1 ? "OK" : "REVERTED"} ${sent.hash}`);
      if (receipt.status === 1) { bought.push({ sym: leg.sym, eth, usd: eth * ethUsd, priceUsd: routes[leg.sym].priceUsd, tx: sent.hash }); usdSpent += eth * ethUsd; }
      else break; // unknown pool state — stop, retry next cycle
    } catch (e) {
      console.error(`  ${leg.sym} STOPPING BUY: ${e.message.slice(0, 120)}`);
      break;
    }
    await sleep(3000); // pacing: one push per ~3s, not a spam burst
  }

  if (bought.length) {
    st.buys.push({
      at: Date.now(),
      usd: usdSpent,
      eth: bought.reduce((s, b) => s + b.eth, 0),
      legs: bought.length,
      assets: bought, // [{sym, eth, tx}] — per-leg detail for the web feed
      mode: LIVE ? "live" : "dry",
    });
    st.buys = st.buys.slice(-200);
    st.totals.buysUsd += usdSpent;
    st.lastBuyAt = Date.now();
    saveState(st);
    console.log(`BUY done: ${bought.length} legs, ~$${usdSpent.toFixed(2)}${LIVE ? "" : " (dry)"}`);
  }
}

// ---------------------------------------------------------------------------
// Cycle: DISTRIBUTE — pro-rata basket transfers to eligible holders
// ---------------------------------------------------------------------------
async function runDistribute(wallet, provider, st) {
  if (!KUMO) { console.log("DIST: HELD — no CA provided yet, not sending to holders (owner instruction)"); return; }
  // FEES-BASED (no cycles): distribute whenever the basket has real value from
  // fees the vault bought. Throttle only guards RPC/gas, not a fixed window.
  if (st.lastDistributeAt && Date.now() - st.lastDistributeAt < DIST_MIN_INTERVAL_MS) return;

  const routes = await getRoutes({ log: false });

  // ── PRE-FLIGHT 1: scan treasury basket value (stockdivvy sync) ──
  // Owner 2026-09-07: sisa selain ETH <= $5 → AUTO STOP, jangan distribusi remeh.
  const basketLegs = []; // {sym, balance, balFloat, priceUsd, usdValue}
  let basketTotalUsd = 0;
  for (const sym of Object.keys(WEIGHTS)) {
    if (!routes[sym] || !(routes[sym].priceUsd > 0)) continue;
    const token = new ethers.Contract(STOCKS[sym], ERC20_ABI, provider);
    let balance;
    try { balance = await token.balanceOf(TREASURY); } catch { continue; }
    if (balance === 0n) continue;
    const balFloat = Number(ethers.formatUnits(balance, DECIMALS[sym]));
    const usdValue = balFloat * routes[sym].priceUsd;
    basketTotalUsd += usdValue;
    basketLegs.push({ sym, balance, balFloat, priceUsd: routes[sym].priceUsd, usdValue });
    await sleep(50);
  }
  // Per-stock $1 minimum: skip entire stock if its basket value is too small.
  // Owner 2026-09-08: "kalau satu stock value $1 skip, yg $2 tetep kirim"
  const eligibleLegs = basketLegs.filter((bl) => bl.usdValue >= MIN_STOCK_USD);
  const skippedStocks = basketLegs.filter((bl) => bl.usdValue < MIN_STOCK_USD);
  if (skippedStocks.length) {
    console.log(`  basket: skipped ${skippedStocks.length} stock(s) below $${MIN_STOCK_USD}: ${skippedStocks.map((s) => `${s.sym} $${s.usdValue.toFixed(2)}`).join(", ")}`);
  }
  basketTotalUsd = eligibleLegs.reduce((s, l) => s + l.usdValue, 0);
  if (basketTotalUsd < MIN_ROUND_USD) {
    console.log(`DIST: basket $${basketTotalUsd.toFixed(2)} <= $${MIN_ROUND_USD} — AUTO STOP, don't burn gas on dust`);
    st.lastDistributeAt = Date.now(); // throttle re-scan; fees keep accruing
    saveState(st);
    return;
  }

  // ── PRE-FLIGHT 2: fresh holder scan + compute payable legs ──
  const holders = await eligibleHolders();
  if (!holders.length) { console.log("DIST: no eligible holders — skip"); return; }
  const totalShare = holders.reduce((s, h) => s + h.balance, 0);
  console.log(`DIST: ${holders.length} holders · basket $${basketTotalUsd.toFixed(2)} (${eligibleLegs.length} legs)`);

  const legs = [];
  let skippedDust = 0;
  for (const bl of eligibleLegs) {
    for (const h of holders) {
      const share = h.balance / totalShare;
      const amountFloat = bl.balFloat * share;
      const usdValue = amountFloat * bl.priceUsd;
      if (usdValue < DUST_USD) { skippedDust++; continue; }
      const amount = ethers.parseUnits(amountFloat.toFixed(DECIMALS[bl.sym]), DECIMALS[bl.sym]);
      if (amount === 0n) continue;
      const data = new ethers.Interface(ERC20_ABI).encodeFunctionData("transfer", [h.address, amount]);
      legs.push({ sym: bl.sym, recipient: h.address, amount, amountFloat, usdValue, sharePct: Number((share * 100).toFixed(4)), tx: { to: STOCKS[bl.sym], data } });
    }
    await sleep(50);
  }

  if (!legs.length) {
    console.log(`DIST: nothing clears the $${DUST_USD} dust floor — basket keeps accruing for the next push`);
    st.lastDistributeAt = Date.now(); // throttle re-scan; value stays in the vault
    saveState(st);
    return;
  }
  const totalUsd = legs.reduce((s, l) => s + l.usdValue, 0);
  console.log(`DIST: ${legs.length} transfers ~$${totalUsd.toFixed(2)} (${skippedDust} legs held as dust)`);

  // Owner 2026-09-07: distribution = ALL IN gas — buy already left the 0.03 float.
  const DIST_GAS_RESERVE_ETH = Number(env.DIST_GAS_RESERVE_ETH || 0);
  const nativeWei = await provider.getBalance(TREASURY);
  const safeGasPriceWei = (await provider.getFeeData()).maxFeePerGas ?? (await provider.getFeeData()).gasPrice ?? 1_000_000_000n;
  const gasPerTxWei = 100_000n * safeGasPriceWei;
  const spendableGasWei = nativeWei > ethers.parseEther(String(DIST_GAS_RESERVE_ETH))
    ? nativeWei - ethers.parseEther(String(DIST_GAS_RESERVE_ETH)) : 0n;
  const maxTxByGas = Number(spendableGasWei / gasPerTxWei);
  const batch = legs.slice(0, Math.max(0, maxTxByGas));
  console.log(`DIST: gas budget ${maxTxByGas} txs (${ethers.formatEther(nativeWei)} ETH); sending ${batch.length}/${legs.length}`);

  // ── SEND: fire-and-forget (stockdivvy sync) — send all txs serially with
  // auto-nonce, NO per-tx receipt wait, then await all receipts at the end.
  const sent = [];
  const pending = [];
  for (let i = 0; i < batch.length; i++) {
    const leg = batch[i];
    if (!LIVE) {
      sent.push(leg);
      if (sent.length <= 5) console.log(`  [dry] ${leg.sym.padEnd(5)} -> ${shortAddr(leg.recipient)} ${leg.amountFloat.toFixed(6)} (~$${leg.usdValue.toFixed(2)})`);
      continue;
    }
    try {
      const tx = { ...leg.tx, gasPrice: safeGasPriceWei, gasLimit: 100_000n, chainId: 4663 };
      const txSent = await wallet.sendTransaction(tx);
      pending.push({ leg, txSent });
      console.log(`  [${i + 1}/${batch.length}] ${leg.sym.padEnd(5)} -> ${shortAddr(leg.recipient)} $${leg.usdValue.toFixed(2)} SENT ${txSent.hash}`);
    } catch (e) {
      console.error(`  [${i + 1}/${batch.length}] TX FAIL: ${e.message.slice(0, 100)}`);
      if (e.message.includes("insufficient funds")) break;
    }
  }
  if (pending.length) {
    console.log(`  awaiting ${pending.length} receipts...`);
    for (let i = 0; i < pending.length; i++) {
      const { leg, txSent } = pending[i];
      try {
        const receipt = await txSent.wait(1);
        console.log(`  [${i + 1}/${pending.length}] ${leg.sym.padEnd(5)} -> ${shortAddr(leg.recipient)} $${leg.usdValue.toFixed(2)} ${receipt.status === 1 ? "OK" : "REVERT"}`);
        if (receipt.status === 1) { leg.txHash = txSent.hash; sent.push(leg); }
      } catch { console.log(`  [${i + 1}/${pending.length}] ${leg.sym.padEnd(5)} -> ${shortAddr(leg.recipient)} UNCONFIRMED`); }
    }
  }

  st.lastDistributeAt = Date.now();
  if (sent.length) recordDistro(st, sent, false);
  st.totals.distributions++;
  saveState(st);
}

// Fold sent legs into payroll + distributions state (stockdivvy sync) — the
// web's Leaderboard/Distributions/wallet pages render straight from the feed.
function recordDistro(st, legs, incremental) {
  const fresh = legs.filter((l) => !l._recorded);
  if (!fresh.length) return;
  const usd = fresh.reduce((s, l) => s + l.usdValue, 0);
  const byRecipient = new Map();
  for (const l of fresh) {
    const key = l.recipient.toLowerCase();
    const row = byRecipient.get(key) || { address: l.recipient, usd: 0, sharePct: l.sharePct ?? 0, txHash: l.txHash || "", assets: [] };
    row.usd += l.usdValue;
    row.assets.push({ sym: l.sym, amount: Number(l.amountFloat.toFixed(6)) });
    if (l.txHash && !row.txHash) row.txHash = l.txHash;
    byRecipient.set(key, row);
  }
  const recipients = [...byRecipient.values()].sort((a, b) => b.usd - a.usd);
  st.payroll = st.payroll || {};
  for (const r of recipients) {
    const key = r.address.toLowerCase();
    const row = st.payroll[key] || { address: r.address, usd: 0, count: 0, firstAt: Date.now(), lastAt: 0 };
    row.usd += r.usd; row.count += 1; row.lastAt = Date.now();
    st.payroll[key] = row;
  }
  st.distributions.push({
    at: Date.now(), transfers: fresh.length, usd,
    recipientsCount: recipients.length,
    recipients: recipients.slice(0, 60), // cap payload; totals stay exact
    mode: LIVE ? "live" : "dry",
  });
  st.distributions = st.distributions.slice(-200);
  st.totals.distributedUsd += usd;
  if (incremental) fresh.forEach((l) => { l._recorded = true; });
  else console.log(`DIST done: ${fresh.length} transfers ~$${usd.toFixed(2)}${LIVE ? "" : " (dry)"}`);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function main() {
  console.log(`AGENTINDEX BOT · mode=${LIVE ? "LIVE (real money)" : "DRY (read + plan only)"} · treasury=${TREASURY} · fees-based distribution · ${!KUMO ? "HELD: waiting for CA (no buy/send)" : "CA=" + KUMO}`);
  const st = loadState();

  let wallet = null;
  if (LIVE || SELFTEST) {
    provider = new ethers.JsonRpcProvider(RH_RPC, undefined, { staticNetwork: true });
    if (LIVE) {
      if (!env.TREASURY_PRIVATE_KEY) { console.error("LIVE mode but no TREASURY_PRIVATE_KEY in .env — refusing."); process.exit(1); }
      wallet = new ethers.Wallet(env.TREASURY_PRIVATE_KEY, provider);
      if (wallet.address.toLowerCase() !== TREASURY) { console.error(`Key controls ${wallet.address}, not treasury ${TREASURY} — refusing.`); process.exit(1); }
    }
  }

  if (SELFTEST) {
    console.log("\nSELFTEST (read-only, nothing written, nothing signed):");
    const [routes, holders, bal, ethUsd] = await Promise.all([getRoutes({ log: false }), !KUMO ? Promise.resolve([]) : eligibleHolders(), getBalanceEth(), getEthPriceUsd()]);
    console.log(`  RPC ok · treasury ETH: ${bal?.toFixed(6)} (~$${((bal || 0) * ethUsd).toFixed(2)})`);
    console.log(`  verified routes: ${Object.keys(routes).length}/${Object.keys(STOCKS).length + 1} legs`);
    console.log(`  eligible holders: ${!KUMO ? "HELD — awaiting CA" : holders.length + " (EOA-only, curve+locker excluded)"}`);
    const top = holders.sort((a, b) => b.balance - a.balance).slice(0, 5);
    for (const h of top) console.log(`    ${h.address} ${(h.balance / 1e6).toFixed(2)}M KUMO`);
    console.log("\nSELFTEST complete — no writes, no spend.");
    return;
  }

  // one immediate pass, then loop
  let metaCacheAt = 0;
  async function refreshMeta() {
    // 5-min cache: these power the web's realtime stats via the published
    // feed, so they must be fresh-ish but don't need every-60s accuracy.
    if (Date.now() - metaCacheAt < 5 * 60_000 && st.meta) return;
    try {
      const [routes, ethUsd] = await Promise.all([getRoutes({ log: false }), getEthPriceUsd()]);
      let basketValueUsd = 0;
      const prices = {};
      for (const [sym, addr] of Object.entries(STOCKS)) {
        if (routes[sym]?.priceUsd > 0) prices[sym] = routes[sym].priceUsd;
        try {
          const bal = await new ethers.Contract(addr, ["function balanceOf(address) view returns (uint256)"], provider).balanceOf(TREASURY);
          basketValueUsd += Number(ethers.formatUnits(bal, DECIMALS[sym])) * (routes[sym]?.priceUsd || 0);
        } catch { /* leg unreadable this round */ }
      }
      let holdersCount = null;
      let supply = null;
      let topHolders = null;
      if (KUMO) {
        try {
          const holders = await eligibleHolders();
          holdersCount = holders.length;
          const erc = new ethers.Contract(KUMO, ["function totalSupply() view returns (uint256)"], provider);
          supply = Number(ethers.formatUnits(await erc.totalSupply(), 18));
          topHolders = holders
            .sort((a, b) => (a.balance < b.balance ? 1 : -1))
            .slice(0, 25)
            .map((h) => ({ address: h.address, balance: Number(ethers.formatUnits(h.balance, 18)) }));
        } catch { /* keep null */ }
      }
      st.meta = { ethUsd, basketValueUsd, holdersCount, supply, topHolders, prices, updatedAt: Date.now() };
      // rolling 24h price history, one point per ~30 min (48 points) — the
      // web computes per-symbol 24h % change from this (replaces Convex's
      // stockPrices cron).
      st.priceHistory = st.priceHistory || [];
      const last = st.priceHistory[st.priceHistory.length - 1];
      if (!last || Date.now() - last.at >= 25 * 60_000) {
        st.priceHistory.push({ at: Date.now(), prices });
        st.priceHistory = st.priceHistory.slice(-48);
      }
      metaCacheAt = Date.now();
    } catch (e) { console.error(`  meta refresh: ${e.message.slice(0, 100)}`); }
  }

  async function pass() {
    if (LIVE) reloadCa();
    st.treasury = { address: TREASURY, eth: await getBalanceEth(), updatedAt: new Date().toISOString() };
    await refreshMeta();
    const now = Date.now();
    if (!st.lastBuyAt || now - st.lastBuyAt >= BUY_MIN_INTERVAL_MS) {
      try { await runBuy(wallet, provider, st); } catch (e) { console.error("BUY error:", e.message.slice(0, 160)); }
    }
    try { await runDistribute(wallet, provider, st); } catch (e) { console.error("DIST error:", e.message.slice(0, 160)); }
    saveState(st);
  }
  await pass();
  if (args.includes("--once")) {
    await pendingPublish; // make sure the snapshot reaches the data repo before exiting
    console.log("once: pass complete, published.");
    process.exit(0);
  }
  console.log(`\ndaemon: polling every ${TICK_MS / 1000}s (buy when spendable ≥ ${BUY_MIN_ETH} ETH, distribute fees-based — no cycles)\n`);
  setInterval(() => pass().catch((e) => console.error("pass error:", e.message)), TICK_MS);
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
