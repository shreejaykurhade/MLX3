"""Persistence for sessions and action logs.

Two backends behind one interface:
  - InMemoryStore  : zero-config, used when Supabase isn't configured (great for demos)
  - SupabaseStore  : Postgres-backed, used when SUPABASE_URL + key are set (see schema.sql)

The agent loop is sequential per session, so the simple count-based seq / leaf_index
assignment here is race-free in practice.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import settings


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class BaseStore:
    async def create_session(self, data: Dict[str, Any]) -> Dict[str, Any]: ...
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]: ...
    async def update_session(self, session_id: str, **fields: Any) -> Optional[Dict[str, Any]]: ...
    async def list_sessions(self, wallet_address: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]: ...
    async def add_action(self, action: Dict[str, Any]) -> Dict[str, Any]: ...
    async def get_actions(self, session_id: str) -> List[Dict[str, Any]]: ...
    async def update_action(self, action_id: str, **fields: Any) -> None: ...
    async def count_actions(self, session_id: str) -> int: ...
    async def count_leaves(self, session_id: str) -> int: ...


# --------------------------------------------------------------------------- #
#  In-memory
# --------------------------------------------------------------------------- #

class InMemoryStore(BaseStore):
    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._actions: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

    async def create_session(self, data: Dict[str, Any]) -> Dict[str, Any]:
        async with self._lock:
            sid = data.get("id") or new_id()
            session = {
                "id": sid,
                "wallet_address": data.get("wallet_address"),
                "task_prompt": data.get("task_prompt"),
                "task_type": data.get("task_type", "prompt"),
                "github_url": data.get("github_url"),
                "status": "created",
                "provider_address": None,
                "plan": None,
                "merkle_root": None,
                "attestation_tx": None,
                "session_id_bytes32": None,
                "leaf_count": 0,
                "simulated": None,
                "error": None,
                "created_at": _now(),
                "updated_at": _now(),
            }
            self._sessions[sid] = session
            self._actions[sid] = []
            return dict(session)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        s = self._sessions.get(session_id)
        return dict(s) if s else None

    async def update_session(self, session_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
        async with self._lock:
            s = self._sessions.get(session_id)
            if not s:
                return None
            s.update(fields)
            s["updated_at"] = _now()
            return dict(s)

    async def list_sessions(self, wallet_address: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        items = list(self._sessions.values())
        if wallet_address:
            wa = wallet_address.lower()
            items = [s for s in items if (s.get("wallet_address") or "").lower() == wa]
        items.sort(key=lambda s: s["created_at"], reverse=True)
        return [dict(s) for s in items[:limit]]

    async def add_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        async with self._lock:
            self._actions.setdefault(action["session_id"], []).append(action)
            return dict(action)

    async def get_actions(self, session_id: str) -> List[Dict[str, Any]]:
        items = self._actions.get(session_id, [])
        return [dict(a) for a in sorted(items, key=lambda a: a["seq"])]

    async def update_action(self, action_id: str, **fields: Any) -> None:
        async with self._lock:
            for actions in self._actions.values():
                for a in actions:
                    if a["id"] == action_id:
                        a.update(fields)
                        return

    async def count_actions(self, session_id: str) -> int:
        return len(self._actions.get(session_id, []))

    async def count_leaves(self, session_id: str) -> int:
        return sum(1 for a in self._actions.get(session_id, []) if a.get("is_leaf"))


# --------------------------------------------------------------------------- #
#  Supabase (Postgres)
# --------------------------------------------------------------------------- #

class SupabaseStore(BaseStore):
    """Wraps the synchronous supabase-py client in threads. Schema in schema.sql."""

    def __init__(self) -> None:
        from supabase import create_client  # imported lazily so it's optional

        self._client = create_client(settings.supabase_url, settings.supabase_key)

    async def _run(self, fn):
        return await asyncio.to_thread(fn)

    async def create_session(self, data: Dict[str, Any]) -> Dict[str, Any]:
        row = {
            "id": data.get("id") or new_id(),
            "wallet_address": data.get("wallet_address"),
            "task_prompt": data.get("task_prompt"),
            "task_type": data.get("task_type", "prompt"),
            "github_url": data.get("github_url"),
            "status": "created",
            "leaf_count": 0,
        }
        res = await self._run(lambda: self._client.table("sessions").insert(row).execute())
        return res.data[0]

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        res = await self._run(
            lambda: self._client.table("sessions").select("*").eq("id", session_id).limit(1).execute()
        )
        return res.data[0] if res.data else None

    async def update_session(self, session_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
        fields["updated_at"] = _now()
        res = await self._run(
            lambda: self._client.table("sessions").update(fields).eq("id", session_id).execute()
        )
        return res.data[0] if res.data else None

    async def list_sessions(self, wallet_address: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        def q():
            builder = self._client.table("sessions").select("*").order("created_at", desc=True).limit(limit)
            if wallet_address:
                builder = builder.eq("wallet_address", wallet_address)
            return builder.execute()

        res = await self._run(q)
        return res.data or []

    async def add_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        res = await self._run(lambda: self._client.table("actions").insert(action).execute())
        return res.data[0]

    async def get_actions(self, session_id: str) -> List[Dict[str, Any]]:
        res = await self._run(
            lambda: self._client.table("actions").select("*").eq("session_id", session_id).order("seq").execute()
        )
        return res.data or []

    async def update_action(self, action_id: str, **fields: Any) -> None:
        await self._run(lambda: self._client.table("actions").update(fields).eq("id", action_id).execute())

    async def count_actions(self, session_id: str) -> int:
        res = await self._run(
            lambda: self._client.table("actions").select("id", count="exact").eq("session_id", session_id).execute()
        )
        return res.count or 0

    async def count_leaves(self, session_id: str) -> int:
        res = await self._run(
            lambda: self._client.table("actions")
            .select("id", count="exact")
            .eq("session_id", session_id)
            .eq("is_leaf", True)
            .execute()
        )
        return res.count or 0


def build_store() -> BaseStore:
    if settings.supabase_enabled:
        try:
            return SupabaseStore()
        except Exception as e:  # fall back rather than crash the demo
            print(f"[store] Supabase init failed ({e}); falling back to in-memory store")
    return InMemoryStore()
