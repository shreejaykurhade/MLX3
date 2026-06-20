import type { AuditBundle, BackendConfig, Provider, Session, ActionItem } from "./types";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json())?.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface CreateSessionInput {
  wallet_address: string;
  task_prompt: string;
  task_type: "prompt" | "github";
  github_url?: string;
}

export const api = {
  getConfig: () => req<BackendConfig>("/config"),

  getProviders: () => req<{ providers: Provider[]; on_chain: boolean }>("/providers"),

  createSession: (body: CreateSessionInput) =>
    req<Session>("/sessions", { method: "POST", body: JSON.stringify(body) }),

  listSessions: (wallet?: string) =>
    req<{ sessions: Session[] }>(`/sessions${wallet ? `?wallet=${wallet}` : ""}`),

  getSession: (id: string) => req<{ session: Session; actions: ActionItem[] }>(`/sessions/${id}`),

  confirm: (id: string, confirmed: boolean) =>
    req<{ ok: boolean }>(`/sessions/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ confirmed }),
    }),

  audit: (id: string) => req<AuditBundle>(`/audit/${id}`),

  nonce: () => req<{ nonce: string }>("/auth/nonce"),

  verify: (body: { address: string; message: string; signature: string }) =>
    req<{ ok: boolean; address: string }>("/auth/verify", { method: "POST", body: JSON.stringify(body) }),
};

export function wsUrl(sessionId: string): string {
  const base = BACKEND_URL.replace(/^http/, "ws");
  return `${base}/ws/sessions/${sessionId}`;
}
