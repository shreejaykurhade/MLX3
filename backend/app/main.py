"""MLX3 FastAPI backend.

Endpoints
  GET  /                          service banner + config summary
  GET  /health                    liveness + chain status
  GET  /providers                 active providers from ProviderRegistry (or default)
  POST /sessions                  create a session and start the planning agent
  GET  /sessions                  list sessions (optional ?wallet=)
  GET  /sessions/{id}             session + action log
  POST /sessions/{id}/confirm     confirm/reject the plan -> runs execution
  GET  /audit/{id}                full audit bundle: actions + Merkle proofs + attestation
  WS   /ws/sessions/{id}          live action stream
  GET  /auth/nonce                SIWE nonce
  POST /auth/verify               SIWE signature verification
"""
from __future__ import annotations

import asyncio
import secrets
import time
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import merkle
from .agent import AgentRunner
from .chain import ChainClient
from .config import settings
from .models import AuthVerifyRequest, ConfirmRequest, CreateSessionRequest
from .store import build_store
from .tools import action_public, provider_public
from .ws import WSManager

app = FastAPI(title="MLX3 Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = build_store()
chain = ChainClient()
ws_manager = WSManager()
runners: Dict[str, AgentRunner] = {}
_nonces: Dict[str, float] = {}


# --------------------------------------------------------------------------- #
#  Projections
# --------------------------------------------------------------------------- #

def session_public(s: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": s["id"],
        "wallet_address": s.get("wallet_address"),
        "task_prompt": s.get("task_prompt"),
        "task_type": s.get("task_type"),
        "github_url": s.get("github_url"),
        "status": s.get("status"),
        "provider_address": s.get("provider_address"),
        "plan": s.get("plan"),
        "merkle_root": s.get("merkle_root"),
        "attestation_tx": s.get("attestation_tx"),
        "session_id_bytes32": s.get("session_id_bytes32"),
        "leaf_count": s.get("leaf_count", 0),
        "simulated": s.get("simulated"),
        "error": s.get("error"),
        "created_at": s.get("created_at"),
        "updated_at": s.get("updated_at"),
    }


# --------------------------------------------------------------------------- #
#  Service
# --------------------------------------------------------------------------- #

@app.get("/")
async def root() -> Dict[str, Any]:
    return {"service": "MLX3 backend", "version": "0.1.0", "config": settings.summary()}


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "chain": chain.status(), "config": settings.summary()}


@app.get("/config")
async def config() -> Dict[str, Any]:
    """Network params + faucet + agent-wallet status for the frontend setup page.

    The *agent* wallet (derived from AGENT_PRIVATE_KEY) is the account that signs
    on-chain attestations — fund THIS address from the faucet to submit real txs.
    """
    st = chain.status()
    agent_address = st.get("agent_address")
    agent_balance = await chain.get_balance(agent_address)
    return {
        "chain": settings.chain_public(),
        "contracts": {
            "provider_registry": settings.provider_registry_address or None,
            "execution_attestation": settings.execution_attestation_address or None,
        },
        "agent": {
            "address": agent_address,
            "balance_wei": str(agent_balance) if agent_balance is not None else None,
            # real on-chain submission needs both a loaded agent key and a deployed contract
            "write_enabled": bool(agent_address) and bool(settings.execution_attestation_address),
        },
        "mode": settings.summary(),
        "rpc_connected": st.get("connected"),
    }


@app.get("/providers")
async def providers() -> Dict[str, Any]:
    from .tools import DEFAULT_PROVIDER

    found = await chain.get_active_providers()
    items = found if found else [DEFAULT_PROVIDER]
    return {"providers": [provider_public(p) for p in items], "on_chain": bool(found)}


# --------------------------------------------------------------------------- #
#  Sessions
# --------------------------------------------------------------------------- #

@app.post("/sessions")
async def create_session(req: CreateSessionRequest) -> Dict[str, Any]:
    session = await store.create_session(req.model_dump())
    runner = AgentRunner(session, store, chain, ws_manager)
    runners[session["id"]] = runner
    asyncio.create_task(runner.run())
    return session_public(session)


@app.get("/sessions")
async def list_sessions(wallet: Optional[str] = None, limit: int = 50) -> Dict[str, Any]:
    items = await store.list_sessions(wallet_address=wallet, limit=limit)
    return {"sessions": [session_public(s) for s in items]}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str) -> Dict[str, Any]:
    s = await store.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    actions = await store.get_actions(session_id)
    return {"session": session_public(s), "actions": [action_public(a) for a in actions]}


@app.post("/sessions/{session_id}/confirm")
async def confirm_session(session_id: str, req: ConfirmRequest) -> Dict[str, Any]:
    s = await store.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    runner = runners.get(session_id)
    if runner is None:
        raise HTTPException(409, "no active run for this session (it may have finished or the server restarted)")
    if s.get("status") not in ("awaiting_confirmation", "planning"):
        raise HTTPException(409, f"session is '{s.get('status')}', not awaiting confirmation")
    runner.confirm(req.confirmed)
    return {"ok": True, "confirmed": req.confirmed}


# --------------------------------------------------------------------------- #
#  Audit
# --------------------------------------------------------------------------- #

@app.get("/audit/{session_id}")
async def audit(session_id: str) -> Dict[str, Any]:
    s = await store.get_session(session_id)
    if not s:
        raise HTTPException(404, "session not found")
    actions = await store.get_actions(session_id)

    leaf_actions = sorted([a for a in actions if a.get("is_leaf")], key=lambda a: a["leaf_index"])
    leaf_hexes = [a["leaf_hash"] for a in leaf_actions]

    leaves = []
    for a in leaf_actions:
        proof = merkle.proof_from_hex_leaves(leaf_hexes, a["leaf_index"]) if leaf_hexes else []
        leaves.append(
            {
                "leaf_index": a["leaf_index"],
                "type": a["type"],
                "title": a["title"],
                "canonical": a["canonical"],
                "leaf_hash": a["leaf_hash"],
                "proof": proof,
            }
        )

    computed_root = merkle.root_from_hex_leaves(leaf_hexes) if leaf_hexes else None

    return {
        "session": session_public(s),
        "actions": [action_public(a) for a in actions],
        "merkle_root": s.get("merkle_root") or computed_root,
        "leaf_count": len(leaf_actions),
        "leaves": leaves,
        "attestation": {
            "tx_hash": s.get("attestation_tx"),
            "simulated": s.get("simulated"),
            "session_id_bytes32": s.get("session_id_bytes32"),
            "explorer_url": (f"{settings.explorer_url}/tx/{s['attestation_tx']}" if s.get("attestation_tx") else None),
        },
        "chain": {
            "chain_id": settings.chain_id,
            "explorer_url": settings.explorer_url,
            "execution_attestation": settings.execution_attestation_address or None,
            "provider_registry": settings.provider_registry_address or None,
        },
    }


# --------------------------------------------------------------------------- #
#  WebSocket
# --------------------------------------------------------------------------- #

@app.websocket("/ws/sessions/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str) -> None:
    await ws_manager.connect(session_id, websocket)
    try:
        s = await store.get_session(session_id)
        actions = await store.get_actions(session_id) if s else []
        await ws_manager.send_to(
            websocket,
            "snapshot",
            {
                "session": session_public(s) if s else None,
                "actions": [action_public(a) for a in actions],
            },
        )
        while True:
            # We don't expect client messages; this keeps the socket open and
            # detects disconnects.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await ws_manager.disconnect(session_id, websocket)


# --------------------------------------------------------------------------- #
#  SIWE auth (simplified)
# --------------------------------------------------------------------------- #

@app.get("/auth/nonce")
async def auth_nonce() -> Dict[str, str]:
    nonce = secrets.token_hex(16)
    _nonces[nonce] = time.time()
    # prune old nonces
    cutoff = time.time() - 600
    for n, t in list(_nonces.items()):
        if t < cutoff:
            _nonces.pop(n, None)
    return {"nonce": nonce}


@app.post("/auth/verify")
async def auth_verify(req: AuthVerifyRequest) -> Dict[str, Any]:
    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct

        recovered = Account.recover_message(encode_defunct(text=req.message), signature=req.signature)
    except Exception as e:
        raise HTTPException(400, f"signature verification failed: {e}")

    ok = recovered.lower() == req.address.lower()
    if not ok:
        raise HTTPException(401, "signature does not match address")
    return {"ok": True, "address": recovered}


@app.on_event("startup")
async def _startup() -> None:
    print("[MLX3] backend up —", settings.summary())
