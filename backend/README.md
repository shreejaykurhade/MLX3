# MLX3 Backend — FastAPI

The agent + verification service. Runs the Claude agent loop (6 structured tools), streams
every SHA-256-hashed action over WebSocket, builds the binary Merkle tree, and submits the
root to `ExecutionAttestation` on Monad testnet.

## Runs with zero external setup

| Dependency | Without it | With it |
|---|---|---|
| `ANTHROPIC_API_KEY` | scripted **mock agent** (realistic plan + execution) | real Claude tool-use loop |
| Supabase | **in-memory** store | Postgres persistence (see `schema.sql`) |
| `AGENT_PRIVATE_KEY` + contracts | **simulated** attestation tx (flagged) | real on-chain submission to Monad |

So `./run.sh` gives you a working end-to-end demo immediately; add the env vars to make it
real.

## Quick start

```bash
cd backend
./run.sh                       # creates .venv, installs deps, copies .env, starts uvicorn
# or manually:
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # fill in what you have (all optional for the mock demo)
uvicorn app.main:app --reload --port 8000
```

Verify the Merkle utilities match the contract scheme (pure stdlib, no install needed):

```bash
python -m app.merkle           # self-test over tree sizes 1,2,3,5,8,9
```

## The 6 agent tools

| Tool | Phase | Effect |
|---|---|---|
| `analyze_task` | plan | reads on-chain providers; logs a leaf |
| `make_plan` | plan | selects a provider, records the plan, **pauses for confirmation**; logs a leaf |
| `execute_step` | exec | runs a mocked-but-realistic step; logs a leaf |
| `hash_action` | exec | commits pending actions into the Merkle log (streams `leaf_committed`) |
| `build_merkle_root` | exec | builds the SHA-256 tree, computes the root |
| `submit_attestation` | exec | submits the root to Monad (or simulates) |

`analyze_task`, `make_plan`, `execute_step` are the tree **leaves**; the closing three are
meta operations. A safety net builds + submits even if the model under-calls them.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness + chain status |
| GET | `/providers` | active providers from `ProviderRegistry` |
| POST | `/sessions` | create session, start planning agent |
| GET | `/sessions` / `/sessions/{id}` | list / fetch session + action log |
| POST | `/sessions/{id}/confirm` | `{confirmed: bool}` → run (or reject) execution |
| GET | `/audit/{id}` | action log + per-leaf Merkle proofs + attestation |
| WS | `/ws/sessions/{id}` | live action stream |
| GET/POST | `/auth/nonce`, `/auth/verify` | simplified SIWE |

## Flow

```
POST /sessions ─▶ agent plans (analyze_task, make_plan) ─▶ status: awaiting_confirmation
      │                                                          │  plan_ready (WS)
   open WS /ws/sessions/{id}                                     ▼
                                            POST /sessions/{id}/confirm {confirmed:true}
                                                                 │
              execute_step + hash_action ×N ─▶ build_merkle_root ─▶ submit_attestation
                                                                 │  completed (WS) + tx hash
                                              GET /audit/{id} ─▶ proofs for the audit page
```

The Merkle scheme is identical to the Solidity contract and the (Step 3) TS verifier — see
the root `README.md`. `app/merkle.py` is the source of truth on the Python side.
