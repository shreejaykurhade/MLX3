# MLX3 — Verifiable Agent Execution on Monad

MLX3 is a decentralized **verifiable agent execution** platform. A user submits a task, an
AI agent (Anthropic Claude) plans and executes it, **every action is SHA-256 hashed into a
Merkle tree**, and the Merkle root is committed on-chain to Monad testnet — so anyone can
later verify exactly what the agent did.

```
 user task ─▶ agent plans ─▶ user confirms ─▶ agent executes (each step hashed)
                                                      │
                                          build binary Merkle tree
                                                      │
                                   submit root ─▶ ExecutionAttestation (Monad)
                                                      │
                              Audit page: paste sessionId ─▶ action log + Merkle
                                          proof + "verified on-chain ✓"
```

## Monorepo layout

```
MLX3/
├── contracts/     Solidity 0.8.24 + Hardhat (Monad testnet)   ← Step 1 (this commit)
│   ├── contracts/
│   │   ├── ProviderRegistry.sol       providers stake MON, set a rate, accrue jobs
│   │   └── ExecutionAttestation.sol   stores (sessionId, root, agent, ts); verifies leaves
│   ├── scripts/   deploy.ts, seed-providers.ts
│   ├── test/      mlx3.test.ts  (proves the SHA-256 Merkle tree verifies on-chain)
│   └── hardhat.config.ts
├── backend/       Python FastAPI — agent loop, WebSocket, Merkle utils   ← Step 2
└── frontend/      Next.js 15 + wagmi/viem + RainbowKit                   ← Step 3
```

## Build order

1. **Contracts + scaffold** (this step) — the two contracts, Hardhat config for Monad
   testnet, deploy + seed scripts, and a test suite proving the Merkle scheme verifies
   on-chain.
2. **FastAPI backend** — session CRUD, the Claude agent loop with 6 tools
   (`analyze_task`, `make_plan`, `execute_step`, `hash_action`, `build_merkle_root`,
   `submit_attestation`), the live WebSocket stream, and the Merkle utilities.
3. **Next.js frontend** — wallet connect + SIWE, dashboard, the deploy flow with a live
   WS stream, and the audit page.
4. **Wire ABIs + end-to-end** — plug the deployed addresses/ABIs into the frontend and run
   the full flow against Monad testnet.

## Monad testnet

| Setting   | Value                              |
| --------- | ---------------------------------- |
| Chain ID  | `10143`                            |
| RPC       | `https://testnet-rpc.monad.xyz`    |
| Currency  | `MON`                              |
| Explorer  | `https://testnet.monadexplorer.com` |
| Faucet    | the Monad testnet faucet (get MON for your deployer address) |

## The Merkle scheme (shared contract across all three languages)

This is the one cross-cutting invariant the whole project depends on. The same tree is
built in Python (Step 2), verified in TypeScript on the audit page (Step 3), and verified
in Solidity on-chain (`ExecutionAttestation.processProof`):

- **leaf**  = `SHA-256(canonical_json(action))`
- **parent**(a, b) = `SHA-256(a ‖ b)` — two 32-byte hashes concatenated
- **odd level** — the last node is duplicated (paired with itself)
- **proof** — the sibling hash at each level, bottom-up
- **index** — the leaf's position in the original action ordering (decides left/right)

SHA-256 is used everywhere (not keccak256) so the exact tree is reproducible with
`hashlib.sha256` in Python and `crypto`/`noble-hashes` in JS. Solidity uses the SHA-256
precompile. `contracts/test/mlx3.test.ts` builds the tree in TS and asserts every leaf
verifies against the on-chain root for trees of size 1, 2, 3, 5, 8, and 9.

## Step 1 — quick start (contracts)

```bash
cd contracts
npm install
cp .env.example .env          # then put your funded deployer key in PRIVATE_KEY

npm test                      # runs the Hardhat test suite (local, no MON needed)
npm run deploy:monad          # deploys to Monad testnet, writes deployments/monadTestnet.json
npm run seed:monad            # (optional) registers a demo provider so the dashboard isn't empty
```

After deploying, `contracts/deployments/monadTestnet.json` holds the addresses the backend
and frontend will read in later steps.

## Status

- [x] **Step 1** — contracts, Hardhat config, deploy/seed scripts, Merkle test suite
- [ ] Step 2 — FastAPI backend
- [ ] Step 3 — Next.js frontend
- [ ] Step 4 — wire ABIs + end-to-end on Monad testnet
