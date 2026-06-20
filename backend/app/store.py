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
                "deployment_status": None,
                "deployment_slug": None,
                "deployment_url": None,
                "deployment_container_id": None,
                "deployment_image": None,
                "deployment_port": None,
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
            "deployment_status": None,
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


# --------------------------------------------------------------------------- #
#  Direct PostgreSQL
# --------------------------------------------------------------------------- #

class PostgresStore(BaseStore):
    """Small psycopg store for production deployments configured by DATABASE_URL."""

    SESSION_COLUMNS = {
        "wallet_address", "task_prompt", "task_type", "github_url", "status",
        "provider_address", "plan", "merkle_root", "attestation_tx",
        "session_id_bytes32", "leaf_count", "simulated", "error",
        "deployment_status", "deployment_slug", "deployment_url",
        "deployment_container_id", "deployment_image", "deployment_port",
    }
    ACTION_COLUMNS = {"committed"}

    def __init__(self) -> None:
        import psycopg

        self._psycopg = psycopg
        self._initialize()

    def _connect(self):
        from psycopg.rows import dict_row

        return self._psycopg.connect(settings.database_url, row_factory=dict_row)

    def _initialize(self) -> None:
        ddl = """
        create table if not exists sessions (
            id uuid primary key, wallet_address text, task_prompt text not null,
            task_type text not null default 'prompt', github_url text,
            status text not null default 'created', provider_address text, plan jsonb,
            merkle_root text, attestation_tx text, session_id_bytes32 text,
            leaf_count integer not null default 0, simulated boolean, error text,
            deployment_status text, deployment_slug text, deployment_url text,
            deployment_container_id text, deployment_image text, deployment_port integer,
            created_at timestamptz not null default now(), updated_at timestamptz not null default now()
        );
        create table if not exists actions (
            id uuid primary key, session_id uuid not null references sessions(id) on delete cascade,
            seq integer not null, type text not null, title text not null, data jsonb,
            is_leaf boolean not null default false, leaf_index integer, canonical text,
            leaf_hash text, committed boolean not null default false,
            created_at timestamptz not null default now(), unique(session_id, seq)
        );
        create index if not exists idx_actions_session on actions(session_id, seq);
        create index if not exists idx_sessions_wallet on sessions(wallet_address);
        alter table sessions add column if not exists deployment_status text;
        alter table sessions add column if not exists deployment_slug text;
        alter table sessions add column if not exists deployment_url text;
        alter table sessions add column if not exists deployment_container_id text;
        alter table sessions add column if not exists deployment_image text;
        alter table sessions add column if not exists deployment_port integer;
        """
        with self._connect() as conn:
            conn.execute(ddl)

    @staticmethod
    def _normalize(row):
        if not row:
            return row
        result = dict(row)
        for key in ("id", "session_id"):
            if result.get(key) is not None:
                result[key] = str(result[key])
        for key in ("created_at", "updated_at"):
            if hasattr(result.get(key), "isoformat"):
                result[key] = result[key].isoformat()
        return result

    async def _run(self, fn):
        return await asyncio.to_thread(fn)

    async def create_session(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sid = data.get("id") or new_id()
        values = (
            sid, data.get("wallet_address"), data.get("task_prompt"),
            data.get("task_type", "prompt"), data.get("github_url"),
        )
        def query():
            with self._connect() as conn:
                row = conn.execute(
                    "insert into sessions (id,wallet_address,task_prompt,task_type,github_url) "
                    "values (%s,%s,%s,%s,%s) returning *", values,
                ).fetchone()
                return self._normalize(row)
        return await self._run(query)

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        def query():
            with self._connect() as conn:
                return self._normalize(conn.execute("select * from sessions where id=%s", (session_id,)).fetchone())
        return await self._run(query)

    async def update_session(self, session_id: str, **fields: Any) -> Optional[Dict[str, Any]]:
        from psycopg.types.json import Jsonb

        fields = {k: v for k, v in fields.items() if k in self.SESSION_COLUMNS}
        if not fields:
            return await self.get_session(session_id)
        assignments = ", ".join(f"{key}=%s" for key in fields)
        values = [Jsonb(v) if key == "plan" and v is not None else v for key, v in fields.items()]
        values.append(session_id)
        def query():
            with self._connect() as conn:
                row = conn.execute(
                    f"update sessions set {assignments}, updated_at=now() where id=%s returning *", values,
                ).fetchone()
                return self._normalize(row)
        return await self._run(query)

    async def list_sessions(self, wallet_address: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        def query():
            with self._connect() as conn:
                if wallet_address:
                    rows = conn.execute(
                        "select * from sessions where lower(wallet_address)=lower(%s) order by created_at desc limit %s",
                        (wallet_address, limit),
                    ).fetchall()
                else:
                    rows = conn.execute("select * from sessions order by created_at desc limit %s", (limit,)).fetchall()
                return [self._normalize(row) for row in rows]
        return await self._run(query)

    async def add_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        from psycopg.types.json import Jsonb

        values = (
            action["id"], action["session_id"], action["seq"], action["type"], action["title"],
            Jsonb(action.get("data")), action.get("is_leaf", False), action.get("leaf_index"),
            action.get("canonical"), action.get("leaf_hash"), action.get("committed", False),
        )
        def query():
            with self._connect() as conn:
                row = conn.execute(
                    "insert into actions (id,session_id,seq,type,title,data,is_leaf,leaf_index,canonical,leaf_hash,committed) "
                    "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) returning *", values,
                ).fetchone()
                return self._normalize(row)
        return await self._run(query)

    async def get_actions(self, session_id: str) -> List[Dict[str, Any]]:
        def query():
            with self._connect() as conn:
                rows = conn.execute("select * from actions where session_id=%s order by seq", (session_id,)).fetchall()
                return [self._normalize(row) for row in rows]
        return await self._run(query)

    async def update_action(self, action_id: str, **fields: Any) -> None:
        fields = {k: v for k, v in fields.items() if k in self.ACTION_COLUMNS}
        if not fields:
            return
        assignments = ", ".join(f"{key}=%s" for key in fields)
        values = [*fields.values(), action_id]
        await self._run(lambda: self._update_action_sync(assignments, values))

    def _update_action_sync(self, assignments: str, values: List[Any]) -> None:
        with self._connect() as conn:
            conn.execute(f"update actions set {assignments} where id=%s", values)

    async def count_actions(self, session_id: str) -> int:
        return await self._count(session_id, False)

    async def count_leaves(self, session_id: str) -> int:
        return await self._count(session_id, True)

    async def _count(self, session_id: str, leaves_only: bool) -> int:
        suffix = " and is_leaf=true" if leaves_only else ""
        def query():
            with self._connect() as conn:
                return int(conn.execute(f"select count(*) as n from actions where session_id=%s{suffix}", (session_id,)).fetchone()["n"])
        return await self._run(query)


def build_store() -> BaseStore:
    if settings.database_enabled:
        try:
            return PostgresStore()
        except Exception as e:
            print(f"[store] Postgres init failed ({e}); falling back")
    if settings.supabase_enabled:
        try:
            return SupabaseStore()
        except Exception as e:  # fall back rather than crash the demo
            print(f"[store] Supabase init failed ({e}); falling back to in-memory store")
    return InMemoryStore()
