"""The 6 agent tools + the shared execution backend.

Both the real Claude agent and the scripted mock agent drive the *same* `execute_tool`
backend through an `AgentContext`, so action logging, SHA-256 hashing, WebSocket
streaming, Merkle building and on-chain attestation are identical either way.

Leaf model (what goes into the Merkle tree):
  - analyze_task, make_plan, execute_step  -> ARE leaves (hashed into the tree)
  - hash_action, build_merkle_root, submit_attestation -> meta ops, NOT leaves

A leaf's `leaf_hash` is computed at log time; `hash_action` just *commits* (announces)
pending leaves for a nice live stream, and `build_merkle_root` auto-commits any stragglers,
so the tree is always complete regardless of how the agent sequences its calls.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from . import merkle
from .chain import ChainClient
from .config import settings
from .mock_compute import run_step
from .store import BaseStore, new_id
from .ws import WSManager

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

# A display-only fallback provider used when ProviderRegistry has none registered.
DEFAULT_PROVIDER = {
    "address": ZERO_ADDRESS,
    "metadata": {"name": "MLX3 Reference Provider", "endpoint": "https://demo.mlx3.xyz", "region": "us-east-1"},
    "rate": "1000000000000000",
    "stake": "10000000000000000",
    "jobs_completed": 0,
    "active": True,
    "registered_at": 0,
}


# --------------------------------------------------------------------------- #
#  Tool schemas (Anthropic tool-use format)
# --------------------------------------------------------------------------- #

TOOL_ANALYZE_TASK = {
    "name": "analyze_task",
    "description": (
        "Analyze the user's task and read the list of available on-chain compute providers "
        "from the ProviderRegistry. Call this FIRST, exactly once. The result includes the "
        "providers you can choose from in make_plan."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "understanding": {"type": "string", "description": "Your understanding of what the user wants."},
            "category": {
                "type": "string",
                "description": "Task category, e.g. data-analysis, code-build, ml-training, web-scrape, general.",
            },
            "complexity": {"type": "string", "enum": ["low", "medium", "high"]},
            "estimated_steps": {"type": "integer", "description": "Rough number of execution steps (2-8)."},
        },
        "required": ["understanding", "category", "complexity", "estimated_steps"],
    },
}

TOOL_MAKE_PLAN = {
    "name": "make_plan",
    "description": (
        "Commit an execution plan and select a provider (by address, from analyze_task's "
        "result). Call AFTER analyze_task, exactly once. Execution PAUSES here for the user "
        "to confirm — do not assume the plan runs immediately."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "provider_address": {"type": "string", "description": "Address of the chosen provider."},
            "summary": {"type": "string", "description": "One-sentence summary of the plan."},
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "command": {"type": "string", "description": "A concrete command/operation this step runs."},
                        "expected_output": {"type": "string"},
                    },
                    "required": ["title", "command", "expected_output"],
                },
            },
        },
        "required": ["provider_address", "summary", "steps"],
    },
}

TOOL_EXECUTE_STEP = {
    "name": "execute_step",
    "description": (
        "Execute one planned step on the selected provider. Compute is mocked but returns "
        "realistic output. Call once per step, in order."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "step_index": {"type": "integer"},
            "title": {"type": "string"},
            "command": {"type": "string"},
        },
        "required": ["step_index", "title", "command"],
    },
}

TOOL_HASH_ACTION = {
    "name": "hash_action",
    "description": (
        "Commit all not-yet-committed actions into the verifiable Merkle log by SHA-256 "
        "hashing each. Call after each execute_step so the action stream stays auditable."
    ),
    "input_schema": {
        "type": "object",
        "properties": {"note": {"type": "string", "description": "Optional note about what you're committing."}},
    },
}

TOOL_BUILD_MERKLE_ROOT = {
    "name": "build_merkle_root",
    "description": (
        "Build the binary SHA-256 Merkle tree over all committed action leaves and compute "
        "the root. Call once, after every step has been executed and hashed."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

TOOL_SUBMIT_ATTESTATION = {
    "name": "submit_attestation",
    "description": (
        "Submit the Merkle root to the ExecutionAttestation contract on Monad testnet, "
        "finalizing the verifiable record. Call once, last."
    ),
    "input_schema": {"type": "object", "properties": {}},
}

PLANNING_TOOLS = [TOOL_ANALYZE_TASK, TOOL_MAKE_PLAN]
EXECUTION_TOOLS = [TOOL_EXECUTE_STEP, TOOL_HASH_ACTION, TOOL_BUILD_MERKLE_ROOT, TOOL_SUBMIT_ATTESTATION]
ALL_TOOLS = PLANNING_TOOLS + EXECUTION_TOOLS

LEAF_TYPES = {"analyze_task", "make_plan", "execute_step"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------- #
#  Execution context
# --------------------------------------------------------------------------- #

class AgentContext:
    """Holds per-session runtime state and the action-logging / hashing helpers."""

    def __init__(self, session: Dict[str, Any], store: BaseStore, chain: ChainClient, ws: WSManager) -> None:
        self.session = session
        self.session_id = session["id"]
        self.store = store
        self.chain = chain
        self.ws = ws
        self.providers: List[Dict[str, Any]] = []
        self.selected_provider: Optional[Dict[str, Any]] = None
        self.plan: Optional[Dict[str, Any]] = None
        self.merkle_root: Optional[str] = None
        self.attestation: Optional[Dict[str, Any]] = None

    # --- session helpers ---

    async def set_status(self, status: str) -> None:
        await self.store.update_session(self.session_id, status=status)
        await self.ws.broadcast(self.session_id, "status", {"status": status})

    async def emit_log(self, text: str) -> None:
        await self.ws.broadcast(self.session_id, "log", {"text": text})

    async def load_providers(self) -> List[Dict[str, Any]]:
        chain_providers = await self.chain.get_active_providers()
        self.providers = chain_providers if chain_providers else [dict(DEFAULT_PROVIDER)]
        return self.providers

    def select_provider(self, address: Optional[str]) -> Dict[str, Any]:
        if address:
            for p in self.providers:
                if p["address"].lower() == address.lower():
                    return p
        return self.providers[0] if self.providers else dict(DEFAULT_PROVIDER)

    # --- action logging / hashing ---

    async def log_action(self, action_type: str, title: str, data: Any) -> Dict[str, Any]:
        is_leaf = action_type in LEAF_TYPES
        seq = await self.store.count_actions(self.session_id)
        leaf_index: Optional[int] = None
        canonical: Optional[str] = None
        leaf_hash: Optional[str] = None
        if is_leaf:
            leaf_index = await self.store.count_leaves(self.session_id)
            canonical = merkle.canonical_action(self.session_id, leaf_index, action_type, title, data)
            leaf_hash = merkle.leaf_hash_hex(canonical)

        action = {
            "id": new_id(),
            "session_id": self.session_id,
            "seq": seq,
            "type": action_type,
            "title": title,
            "data": data,
            "is_leaf": is_leaf,
            "leaf_index": leaf_index,
            "canonical": canonical,
            "leaf_hash": leaf_hash,
            "committed": False,
            "created_at": _now(),
        }
        await self.store.add_action(action)
        await self.ws.broadcast(self.session_id, "action", action_public(action))
        return action

    async def commit_pending(self) -> List[Dict[str, Any]]:
        """Mark uncommitted leaves as committed; stream a leaf_committed event per leaf."""
        actions = await self.store.get_actions(self.session_id)
        newly: List[Dict[str, Any]] = []
        for a in actions:
            if a.get("is_leaf") and not a.get("committed"):
                await self.store.update_action(a["id"], committed=True)
                entry = {"leaf_index": a["leaf_index"], "leaf_hash": a["leaf_hash"], "title": a["title"]}
                newly.append(entry)
                await self.ws.broadcast(self.session_id, "leaf_committed", entry)
        return newly

    async def _leaves(self) -> List[Dict[str, Any]]:
        actions = await self.store.get_actions(self.session_id)
        leaves = [a for a in actions if a.get("is_leaf")]
        leaves.sort(key=lambda a: a["leaf_index"])
        return leaves

    async def build_root(self) -> Dict[str, Any]:
        await self.commit_pending()
        leaves = await self._leaves()
        leaf_hexes = [a["leaf_hash"] for a in leaves]
        root = merkle.root_from_hex_leaves(leaf_hexes) if leaf_hexes else None
        self.merkle_root = root
        await self.store.update_session(self.session_id, merkle_root=root, leaf_count=len(leaves))
        payload = {"merkle_root": root, "leaf_count": len(leaves)}
        await self.ws.broadcast(self.session_id, "merkle_root", payload)
        return payload

    async def submit(self) -> Dict[str, Any]:
        if not self.merkle_root:
            await self.build_root()
        leaves = await self._leaves()
        provider_addr = self.selected_provider["address"] if self.selected_provider else ZERO_ADDRESS
        sid_b32 = self.chain.session_id_to_bytes32(self.session_id)
        if not sid_b32.startswith("0x"):
            sid_b32 = "0x" + sid_b32
        result = await self.chain.submit_attestation(sid_b32, self.merkle_root, provider_addr, len(leaves))
        explorer_url = f"{settings.explorer_url}/tx/{result['tx_hash']}"
        self.attestation = {
            "tx_hash": result["tx_hash"],
            "simulated": result.get("simulated", True),
            "session_id_bytes32": sid_b32,
            "explorer_url": explorer_url,
            "block_number": result.get("block_number"),
        }
        await self.store.update_session(
            self.session_id,
            status="completed",
            attestation_tx=result["tx_hash"],
            session_id_bytes32=sid_b32,
            simulated=result.get("simulated", True),
        )
        deployment = {
            "deployment_status": self.session.get("deployment_status"),
            "deployment_slug": self.session.get("deployment_slug"),
            "deployment_url": self.session.get("deployment_url"),
        }
        await self.ws.broadcast(
            self.session_id,
            "completed",
            {
                **self.attestation,
                **deployment,
                "merkle_root": self.merkle_root,
                "leaf_count": len(leaves),
            },
        )
        return self.attestation


# --------------------------------------------------------------------------- #
#  Public projections
# --------------------------------------------------------------------------- #

def provider_public(p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "address": p["address"],
        "metadata": p.get("metadata"),
        "rate": p.get("rate"),
        "stake": p.get("stake"),
        "jobs_completed": p.get("jobs_completed", 0),
    }


def action_public(a: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": a["id"],
        "seq": a["seq"],
        "type": a["type"],
        "title": a["title"],
        "data": a["data"],
        "is_leaf": a["is_leaf"],
        "leaf_index": a["leaf_index"],
        "leaf_hash": a["leaf_hash"],
        "committed": a["committed"],
        "created_at": a["created_at"],
    }


# --------------------------------------------------------------------------- #
#  Tool execution
# --------------------------------------------------------------------------- #

async def execute_tool(ctx: AgentContext, name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
    if name == "analyze_task":
        providers = await ctx.load_providers()
        data = {
            "understanding": tool_input.get("understanding", ""),
            "category": tool_input.get("category", "general"),
            "complexity": tool_input.get("complexity", "medium"),
            "estimated_steps": tool_input.get("estimated_steps", 4),
            "providers_seen": len(providers),
        }
        await ctx.log_action("analyze_task", f"Analyzed task ({data['category']})", data)
        return {
            "status": "analyzed",
            "provider_count": len(providers),
            "providers": [provider_public(p) for p in providers],
        }

    if name == "make_plan":
        provider = ctx.select_provider(tool_input.get("provider_address"))
        steps = tool_input.get("steps", [])
        plan = {
            "summary": tool_input.get("summary", ""),
            "steps": steps,
            "provider": provider_public(provider),
        }
        ctx.plan = plan
        ctx.selected_provider = provider
        await ctx.log_action(
            "make_plan",
            f"Planned {len(steps)} step(s) on {provider['metadata'].get('name', provider['address'])}",
            {"summary": plan["summary"], "steps": steps, "provider_address": provider["address"]},
        )
        await ctx.store.update_session(ctx.session_id, plan=plan, provider_address=provider["address"])
        return {"status": "plan_recorded", "step_count": len(steps), "provider_address": provider["address"]}

    if name == "execute_step":
        title = tool_input.get("title", f"Step {tool_input.get('step_index', 0)}")
        command = tool_input.get("command", "")
        result = run_step(title, command)
        await ctx.log_action(
            "execute_step",
            f"Executed: {title}",
            {
                "step_index": tool_input.get("step_index"),
                "command": command,
                "stdout": result["stdout"],
                "exit_code": result["exit_code"],
                "duration_ms": result["duration_ms"],
                "resources": result["resources"],
            },
        )
        preview = result["stdout"].splitlines()
        return {
            "status": "executed",
            "exit_code": result["exit_code"],
            "duration_ms": result["duration_ms"],
            "stdout_preview": preview[-1] if preview else "",
        }

    if name == "hash_action":
        newly = await ctx.commit_pending()
        total = await ctx.store.count_leaves(ctx.session_id)
        return {"status": "committed", "newly_committed": newly, "total_leaves": total}

    if name == "build_merkle_root":
        payload = await ctx.build_root()
        return {"status": "built", **payload}

    if name == "submit_attestation":
        att = await ctx.submit()
        return {"status": "submitted", **att}

    return {"status": "error", "message": f"unknown tool {name}"}
