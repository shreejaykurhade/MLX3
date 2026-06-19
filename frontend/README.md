# MLX3 Frontend — Next.js 15

Next.js 15 (App Router) + TypeScript + Tailwind + wagmi/viem + RainbowKit, configured for
**Monad testnet** (chainId `10143`).

## Pages

| Route | What it does |
|---|---|
| `/` | Dashboard — connect wallet + SIWE sign-in, active providers (from `ProviderRegistry`), your recent sessions |
| `/deploy` | Submit a task/GitHub URL → confirm the agent's plan → watch each SHA-256-hashed action stream in live over WebSocket → see the Merkle root + attestation tx |
| `/audit` | Paste a `sessionId` → full action log + per-leaf Merkle proof + **"Verified on-chain ✓"** badge linking to the Monad explorer |

## Quick start

```bash
cd frontend
npm install
cp .env.local.example .env.local     # defaults are fine for a local demo
npm run dev                           # http://localhost:3000
```

Run the backend (`../backend && ./run.sh`) alongside it. Everything works with no contract
deployment — the audit page verifies Merkle proofs locally and switches to on-chain `verify`
once `NEXT_PUBLIC_EXECUTION_ATTESTATION_ADDRESS` is set and a real attestation exists.

## Verification (audit page)

Each leaf is checked three ways, mirroring the cross-language Merkle scheme:

1. **`hash`** — `sha256(stored canonical) === leaf_hash` (recomputed in [src/lib/merkle.ts](src/lib/merkle.ts))
2. **`proof`** — the sibling proof reconstructs the committed Merkle root
3. **`chain`** — `ExecutionAttestation.verify(sessionId, leaf, proof, index)` via viem (when the contract is deployed and the tx is real)

ABIs in [src/abis/](src/abis) are extracted from the Hardhat artifacts; addresses come from
`NEXT_PUBLIC_*` env (or `../contracts/deployments/monadTestnet.json`).

## Env

See `.env.local.example`. Notable: set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for the
WalletConnect modal (injected wallets like MetaMask work without it), and the contract
addresses to enable on-chain verification on the audit page.
