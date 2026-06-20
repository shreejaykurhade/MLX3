"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, wsUrl } from "./api";
import type { ActionItem, Plan, Session, SessionStatus, WSEvent } from "./types";

export interface Completion {
  merkle_root: string;
  attestation_tx: string;
  simulated: boolean;
  session_id_bytes32?: string;
  explorer_url?: string;
  leaf_count?: number;
  block_number?: number | null;
  deployment_status?: string | null;
  deployment_slug?: string | null;
  deployment_url?: string | null;
}

export interface StreamState {
  session: Session | null;
  status: SessionStatus | null;
  actions: ActionItem[];
  plan: Plan | null;
  completion: Completion | null;
  logs: string[];
  error: string | null;
  connected: boolean;
}

const EMPTY: StreamState = {
  session: null,
  status: null,
  actions: [],
  plan: null,
  completion: null,
  logs: [],
  error: null,
  connected: false,
};

/** Subscribe to a session's live action stream. Seeds from REST, then merges WS events. */
export function useSessionStream(sessionId: string | null): StreamState {
  const [state, setState] = useState<StreamState>(EMPTY);
  const wsRef = useRef<WebSocket | null>(null);

  const apply = useCallback((ev: WSEvent) => {
    setState((prev) => {
      const next = { ...prev };
      switch (ev.type) {
        case "snapshot": {
          if (ev.data?.session) {
            next.session = ev.data.session;
            next.status = ev.data.session.status;
            if (ev.data.session.plan) next.plan = ev.data.session.plan;
          }
          if (Array.isArray(ev.data?.actions)) next.actions = mergeActions(prev.actions, ev.data.actions);
          break;
        }
        case "status":
          next.status = ev.data.status;
          if (next.session) next.session = { ...next.session, status: ev.data.status };
          break;
        case "action":
          next.actions = mergeActions(prev.actions, [ev.data]);
          break;
        case "leaf_committed":
          next.actions = prev.actions.map((a) =>
            a.leaf_index === ev.data.leaf_index && a.is_leaf ? { ...a, committed: true } : a
          );
          break;
        case "plan_ready":
          next.plan = ev.data.plan ?? next.plan;
          break;
        case "log":
          next.logs = [...prev.logs, ev.data.text];
          break;
        case "merkle_root":
          if (next.session) next.session = { ...next.session, merkle_root: ev.data.merkle_root, leaf_count: ev.data.leaf_count };
          break;
        case "deployment":
          if (next.session)
            next.session = {
              ...next.session,
              deployment_status: ev.data.status,
              deployment_url: ev.data.url ?? next.session.deployment_url,
              deployment_slug: ev.data.slug ?? next.session.deployment_slug,
            };
          break;
        case "completed":
          next.completion = ev.data as Completion;
          next.status = "completed";
          if (next.session)
            next.session = {
              ...next.session,
              status: "completed",
              merkle_root: ev.data.merkle_root,
              attestation_tx: ev.data.tx_hash,
              session_id_bytes32: ev.data.session_id_bytes32,
              simulated: ev.data.simulated,
              deployment_status: ev.data.deployment_status,
              deployment_url: ev.data.deployment_url,
              deployment_slug: ev.data.deployment_slug,
            };
          break;
        case "error":
          next.error = ev.data.message;
          next.status = "failed";
          break;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;

    // Seed from REST so we have state even if the WS connects after some events.
    api
      .getSession(sessionId)
      .then(({ session, actions }) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          session,
          status: session.status,
          plan: session.plan ?? prev.plan,
          actions: mergeActions(prev.actions, actions),
          completion:
            session.status === "completed" && session.merkle_root && session.attestation_tx
              ? {
                  merkle_root: session.merkle_root,
                  attestation_tx: session.attestation_tx,
                  simulated: !!session.simulated,
                  session_id_bytes32: session.session_id_bytes32 ?? undefined,
                  leaf_count: session.leaf_count,
                  deployment_status: session.deployment_status,
                  deployment_url: session.deployment_url,
                  deployment_slug: session.deployment_slug,
                }
              : prev.completion,
        }));
      })
      .catch(() => {/* not fatal — WS snapshot will fill in */});

    const ws = new WebSocket(wsUrl(sessionId));
    wsRef.current = ws;
    ws.onopen = () => setState((p) => ({ ...p, connected: true }));
    ws.onclose = () => setState((p) => ({ ...p, connected: false }));
    ws.onmessage = (e) => {
      try {
        apply(JSON.parse(e.data) as WSEvent);
      } catch {
        /* ignore malformed */
      }
    };

    return () => {
      cancelled = true;
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId, apply]);

  return state;
}

function mergeActions(existing: ActionItem[], incoming: ActionItem[]): ActionItem[] {
  const byId = new Map<string, ActionItem>();
  for (const a of existing) byId.set(a.id, a);
  for (const a of incoming) {
    const prev = byId.get(a.id);
    // keep committed=true if either side has it (leaf_committed may arrive separately)
    byId.set(a.id, prev ? { ...prev, ...a, committed: prev.committed || a.committed } : a);
  }
  return Array.from(byId.values()).sort((x, y) => x.seq - y.seq);
}
