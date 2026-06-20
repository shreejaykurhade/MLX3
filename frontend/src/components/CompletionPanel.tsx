"use client";

import Link from "next/link";
import { HashChip } from "./ui";

export function CompletionPanel({
  sessionId,
  merkleRoot,
  txHash,
  simulated,
  explorerUrl,
  leafCount,
  showAuditLink = true,
  deploymentUrl,
}: {
  sessionId: string;
  merkleRoot?: string | null;
  txHash?: string | null;
  simulated?: boolean | null;
  explorerUrl?: string | null;
  leafCount?: number;
  showAuditLink?: boolean;
  deploymentUrl?: string | null;
}) {
  return (
    <div className="card border-ok/40">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ok/20 text-ok">✓</span>
        <h3 className="font-semibold">Attestation submitted</h3>
        {simulated && (
          <span className="rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs text-warn">
            simulated
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="label">Merkle root</dt>
          <dd>
            <HashChip value={merkleRoot} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="label">Transaction</dt>
          <dd>
            <HashChip value={txHash} href={explorerUrl || undefined} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="label">Leaves committed</dt>
          <dd>{leafCount ?? "—"}</dd>
        </div>
      </dl>

      {simulated && (
        <p className="mt-3 text-xs text-muted">
          No agent key / contract configured, so the transaction was simulated. Set{" "}
          <code className="mono">AGENT_PRIVATE_KEY</code> + contract addresses in the backend to submit on-chain.
        </p>
      )}

      <div className="mt-4 flex gap-3">
        {deploymentUrl && (
          <a href={deploymentUrl} target="_blank" rel="noreferrer" className="btn-primary flex-1">
            Open deployment
          </a>
        )}
        {showAuditLink && (
          <Link href={`/audit?session=${sessionId}`} className="btn-primary flex-1">
            Open audit & verify →
          </Link>
        )}
        {explorerUrl && !simulated && (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="btn-ghost">
            View on explorer
          </a>
        )}
      </div>
    </div>
  );
}
