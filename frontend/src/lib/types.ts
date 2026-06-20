export type SessionStatus =
  | "created"
  | "planning"
  | "awaiting_confirmation"
  | "executing"
  | "completed"
  | "rejected"
  | "failed";

export interface PlanStep {
  title: string;
  command: string;
  expected_output?: string;
}

export interface Provider {
  address: string;
  metadata: { name?: string; endpoint?: string; region?: string; gpu?: string } | Record<string, unknown> | null;
  rate: string;
  stake: string;
  jobs_completed: number;
}

export interface Plan {
  summary: string;
  steps: PlanStep[];
  provider: Provider;
}

export interface Session {
  id: string;
  wallet_address?: string;
  task_prompt?: string;
  task_type?: "prompt" | "github";
  github_url?: string | null;
  status: SessionStatus;
  provider_address?: string | null;
  plan?: Plan | null;
  merkle_root?: string | null;
  attestation_tx?: string | null;
  session_id_bytes32?: string | null;
  leaf_count: number;
  simulated?: boolean | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActionItem {
  id: string;
  seq: number;
  type: "analyze_task" | "make_plan" | "execute_step" | "hash_action" | "build_merkle_root" | "submit_attestation" | string;
  title: string;
  data: Record<string, unknown>;
  is_leaf: boolean;
  leaf_index: number | null;
  leaf_hash: string | null;
  committed: boolean;
  created_at: string;
}

export interface AuditLeaf {
  leaf_index: number;
  type: string;
  title: string;
  canonical: string;
  leaf_hash: string;
  proof: string[];
}

export interface AuditBundle {
  session: Session;
  actions: ActionItem[];
  merkle_root: string | null;
  leaf_count: number;
  leaves: AuditLeaf[];
  attestation: {
    tx_hash: string | null;
    simulated: boolean | null;
    session_id_bytes32: string | null;
    explorer_url: string | null;
  };
  chain: {
    chain_id: number;
    explorer_url: string;
    execution_attestation: string | null;
    provider_registry: string | null;
  };
}

export interface BackendConfig {
  chain: {
    chain_id: number;
    chain_id_hex: string;
    network_name: string;
    rpc_url: string;
    explorer_url: string;
    currency_symbol: string;
    faucet_url: string;
  };
  contracts: { provider_registry: string | null; execution_attestation: string | null };
  agent: { address: string | null; balance_wei: string | null; write_enabled: boolean };
  mode: { agent: string; store: string; chain_read: boolean; chain_write: boolean };
  rpc_connected: boolean;
}

export interface WSEvent {
  type:
    | "snapshot"
    | "status"
    | "action"
    | "leaf_committed"
    | "plan_ready"
    | "log"
    | "merkle_root"
    | "completed"
    | "error";
  session_id?: string;
  ts?: string;
  data: any;
}
