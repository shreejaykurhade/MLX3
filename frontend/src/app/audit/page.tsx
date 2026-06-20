"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createPublicClient, http } from "viem";
import { HashChip, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import {
  EXECUTION_ATTESTATION_ABI,
  EXECUTION_ATTESTATION_ADDRESS,
  txUrl,
} from "@/lib/contracts";
import { leafHashHex, verifyProof } from "@/lib/merkle";
import { monadTestnet } from "@/lib/wagmi";
import type { AuditBundle, AuditLeaf } from "@/lib/types";

type OnChain = "idle" | "checking" | "verified" | "failed" | "unavailable";

interface LeafCheck {
  leaf: AuditLeaf;
  canonicalOk: boolean; // sha256(canonical) === leaf_hash
  proofOk: boolean; // proof reconstructs the committed root
  onChain: boolean | null; // contract.verify result (null = not checked)
}

function AuditInner() {
  const params = useSearchParams();
  const [input, setInput] = useState("");
  const [bundle, setBundle] = useState<AuditBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [onChainState, setOnChainState] = useState<OnChain>("idle");
  const [checks, setChecks] = useState<LeafCheck[]>([]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(undefined);
    setBundle(null);
    setChecks([]);
    setOnChainState("idle");
    try {
      const b = await api.audit(id.trim());
      setBundle(b);
      const root = b.merkle_root || "";
      setChecks(
        b.leaves.map((leaf) => ({
          leaf,
          canonicalOk: leafHashHex(leaf.canonical).toLowerCase() === leaf.leaf_hash.toLowerCase(),
          proofOk: !!root && verifyProof(leaf.leaf_hash, leaf.proof, leaf.leaf_index, root),
          onChain: null,
        }))
      );
    } catch (e: any) {
      setError(e?.message || "failed to load audit");
    } finally {
      setLoading(false);
    }
  }, []);

  // Prefill + auto-load from ?session=
  useEffect(() => {
    const id = params.get("session");
    if (id) {
      setInput(id);
      load(id);
    }
  }, [params, load]);

  const localOk = useMemo(
    () => checks.length > 0 && checks.every((c) => c.canonicalOk && c.proofOk),
    [checks]
  );

  const canVerifyOnChain =
    !!bundle &&
    !!EXECUTION_ATTESTATION_ADDRESS &&
    !!bundle.session.session_id_bytes32 &&
    !bundle.attestation.simulated &&
    checks.length > 0;

  async function verifyOnChain() {
    if (!bundle || !EXECUTION_ATTESTATION_ADDRESS || !bundle.session.session_id_bytes32) return;
    setOnChainState("checking");
    const client = createPublicClient({ chain: monadTestnet, transport: http() });
    const sid = bundle.session.session_id_bytes32 as `0x${string}`;
    try {
      const results = await Promise.all(
        checks.map(
          (c) =>
            client.readContract({
              address: EXECUTION_ATTESTATION_ADDRESS!,
              abi: EXECUTION_ATTESTATION_ABI as any,
              functionName: "verify",
              args: [sid, c.leaf.leaf_hash as `0x${string}`, c.leaf.proof as `0x${string}`[], BigInt(c.leaf.leaf_index)],
            } as any) as Promise<boolean>
        )
      );
      setChecks((prev) => prev.map((c, i) => ({ ...c, onChain: results[i] })));
      setOnChainState(results.every(Boolean) ? "verified" : "failed");
    } catch (e) {
      setOnChainState("failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit a session</h1>
        <p className="mt-1 text-sm text-muted">
          Paste a session ID to inspect the full action log, verify each Merkle proof, and confirm the attestation.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) load(input);
        }}
        className="flex gap-2"
      >
        <input
          className="input mono"
          placeholder="session id (uuid)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          {loading ? <Spinner /> : "Load"}
        </button>
      </form>

      {error && <div className="card border-bad/40 text-sm text-bad">{error}</div>}

      {bundle && (
        <>
          {/* Verification banner */}
          <div
            className={`card ${
              onChainState === "verified"
                ? "border-ok/50"
                : localOk
                ? "border-ok/40"
                : "border-bad/40"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={bundle.session.status} />
                {onChainState === "verified" ? (
                  <Badge tone="ok">Verified on-chain ✓</Badge>
                ) : localOk ? (
                  <Badge tone="ok">Proofs valid ✓ {bundle.attestation.simulated ? "(local)" : ""}</Badge>
                ) : (
                  <Badge tone="bad">Verification failed</Badge>
                )}
                {onChainState === "checking" && (
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <Spinner /> checking on-chain…
                  </span>
                )}
              </div>

              {canVerifyOnChain && onChainState === "idle" && (
                <button onClick={verifyOnChain} className="btn-ghost">
                  Verify on-chain
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Row label="Session ID">
                <HashChip value={bundle.session.id} />
              </Row>
              <Row label="On-chain ID (bytes32)">
                <HashChip value={bundle.session.session_id_bytes32} />
              </Row>
              <Row label="Merkle root">
                <HashChip value={bundle.merkle_root} />
              </Row>
              <Row label="Attestation tx">
                <HashChip
                  value={bundle.attestation.tx_hash}
                  href={bundle.attestation.tx_hash && !bundle.attestation.simulated ? txUrl(bundle.attestation.tx_hash) : undefined}
                />
              </Row>
            </div>

            {!EXECUTION_ATTESTATION_ADDRESS && (
              <p className="mt-3 text-xs text-muted">
                On-chain verify needs <code className="mono">NEXT_PUBLIC_EXECUTION_ATTESTATION_ADDRESS</code>. The
                local proof check above already confirms each leaf reconstructs the committed root.
              </p>
            )}
            {bundle.attestation.simulated && (
              <p className="mt-3 text-xs text-muted">
                This attestation was simulated (no agent key configured), so there is no on-chain tx to verify against.
                The Merkle proofs are still cryptographically valid.
              </p>
            )}
          </div>

          {/* Task */}
          <div className="card">
            <div className="label">Task</div>
            <p className="mt-1 text-sm text-gray-200">
              {bundle.session.task_type === "github" ? bundle.session.github_url : bundle.session.task_prompt}
            </p>
          </div>

          {/* Action log */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">
              Action log <span className="text-sm font-normal text-muted">({bundle.actions.length})</span>
            </h2>
            <div className="space-y-2">
              {bundle.actions.map((a) => {
                const check = a.is_leaf ? checks.find((c) => c.leaf.leaf_index === a.leaf_index) : undefined;
                return <LeafRow key={a.id} title={a.title} type={a.type} leafIndex={a.leaf_index} leafHash={a.leaf_hash} check={check} />;
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="label">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Badge({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        tone === "ok" ? "border-ok/50 bg-ok/10 text-ok" : "border-bad/50 bg-bad/10 text-bad"
      }`}
    >
      {children}
    </span>
  );
}

function LeafRow({
  title,
  type,
  leafIndex,
  leafHash,
  check,
}: {
  title: string;
  type: string;
  leafIndex: number | null;
  leafHash: string | null;
  check?: LeafCheck;
}) {
  const [open, setOpen] = useState(false);
  const isLeaf = leafIndex !== null && leafHash;

  return (
    <div className="rounded-lg border border-edge bg-panel2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isLeaf ? (
            <span className="mono shrink-0 rounded bg-panel px-1.5 py-0.5 text-muted">#{leafIndex}</span>
          ) : (
            <span className="mono shrink-0 rounded bg-panel px-1.5 py-0.5 text-muted">meta</span>
          )}
          <span className="truncate text-sm">{title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {check && (
            <>
              <Tick ok={check.canonicalOk} label="hash" />
              <Tick ok={check.proofOk} label="proof" />
              {check.onChain !== null && <Tick ok={check.onChain} label="chain" />}
              {leafHash && (
                <button onClick={() => setOpen((o) => !o)} className="text-muted hover:text-white">
                  {open ? "▾" : "▸"}
                </button>
              )}
            </>
          )}
          {!isLeaf && <span className="text-xs text-muted">{type}</span>}
        </div>
      </div>
      {open && check && (
        <div className="mt-2 space-y-1 border-t border-edge pt-2">
          <KV k="leaf_hash" v={leafHash!} />
          <KV k="canonical" v={check.leaf.canonical} wrap />
          <KV k="proof" v={check.leaf.proof.length ? check.leaf.proof.join("\n") : "(root leaf — empty proof)"} wrap />
        </div>
      )}
    </div>
  );
}

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`mono inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] ${
        ok ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"
      }`}
      title={label}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

function KV({ k, v, wrap }: { k: string; v: string; wrap?: boolean }) {
  return (
    <div className="text-xs">
      <span className="label">{k}</span>
      <pre className={`mono mt-0.5 text-gray-400 ${wrap ? "whitespace-pre-wrap break-all" : ""}`}>{v}</pre>
    </div>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuditInner />
    </Suspense>
  );
}
