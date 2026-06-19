"""WebSocket connection manager — broadcasts agent events per session.

Event envelope (all events sent to /ws/sessions/{id}):
    { "type": <event_type>, "session_id": <id>, "ts": <iso8601>, "data": {...} }

Event types the frontend (Step 3) consumes:
    snapshot       initial state on connect: { session, actions }
    status         { status }                          session status changed
    action         { ...action }                       a new agent action was logged
    leaf_committed { leaf_index, leaf_hash }            an action was hashed into the tree
    plan_ready     { plan, provider }                   plan awaiting user confirmation
    log            { text }                             agent free-text / narration
    merkle_root    { merkle_root, leaf_count }          tree built
    completed      { merkle_root, attestation_tx, ... } attestation submitted
    error          { message }                          run failed
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Set

from fastapi import WebSocket


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class WSManager:
    def __init__(self) -> None:
        self._conns: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._conns[session_id].add(ws)

    async def disconnect(self, session_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._conns[session_id].discard(ws)
            if not self._conns[session_id]:
                self._conns.pop(session_id, None)

    async def broadcast(self, session_id: str, event_type: str, data: Any) -> None:
        envelope = {"type": event_type, "session_id": session_id, "ts": _now(), "data": data}
        async with self._lock:
            targets = list(self._conns.get(session_id, ()))
        dead = []
        for ws in targets:
            try:
                await ws.send_json(envelope)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._conns.get(session_id, set()).discard(ws)

    async def send_to(self, ws: WebSocket, event_type: str, data: Any) -> None:
        await ws.send_json({"type": event_type, "ts": _now(), "data": data})
