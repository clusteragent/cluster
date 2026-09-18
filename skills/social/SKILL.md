---
name: social
description: Social identity and tipping between wallets on cluster. Use when the user wants to link or unlink their X (Twitter) handle to a wallet, look up a wallet's public profile (handle, tip counters), or record a $CLST tip intent to another wallet. Tips are intent records (settlement happens with the token); self-tips are blocked and recipients must be valid 0x addresses.
allowed-tools: Read, Bash(curl:*)
license: MIT
metadata:
  author: clusteragent
  version: "1.0.0"
---

# Cluster Social

Wallets are the identity. X handles are optional public labels on top.

## Public Profile (no auth)

```bash
curl "https://clusteragent.dev/api/social/profile?wallet=0xADDRESS"
# → { wallet, x_handle, x_linked, tips_sent, tips_received, tip_total_usd }
```

MCP: `social_profile { wallet }`.

## Link / Unlink X (wallet-auth required)

```bash
curl -X POST "https://clusteragent.dev/api/social/link-x" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xUSER","session_token":"…","handle":"@name"}'
# empty handle = unlink
```

Handles are normalized (lowercased, `@` stripped). One link per wallet —
re-linking replaces.

## Tips (wallet-auth required)

```bash
curl -X POST "https://clusteragent.dev/api/social/tip" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0xFROM","session_token":"…","to":"0xTO","amount":"1.5","note":"…"}'
```

Rules (enforced server-side):

- Recipient must be a valid `0x` address; **self-tips rejected**
- Amount must be numeric
- Tips are **intent records** — on-chain $CLST settlement happens with the token,
  this ledger is the social proof layer

## Wallet Auth (all write calls)

1. `GET /api/auth/challenge?wallet=0x…` → message
2. `personal_sign` the message in the user's wallet
3. `POST /api/auth/session` → 60-minute `session_token`
4. Pass `session_token` (or the raw `signature`) with the write call
