"use client";

import type { Plan } from "@/lib/types";
import { providerName, shortHex, formatMon } from "@/lib/format";
import { Spinner } from "./ui";

export function PlanCard({
  plan,
  onConfirm,
  onReject,
  busy,
}: {
  plan: Plan;
  onConfirm?: () => void;
  onReject?: () => void;
  busy?: boolean;
}) {
  const interactive = !!onConfirm;
  return (
    <div className="card border-warn/40">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Proposed plan</h3>
        {interactive && <span className="text-xs text-warn">awaiting your confirmation</span>}
      </div>
      <p className="mt-1 text-sm text-gray-300">{plan.summary}</p>

      <div className="mt-3 rounded-lg border border-edge bg-panel2 p-3 text-sm">
        <div className="label">Selected provider</div>
        <div className="mt-0.5 flex items-center justify-between">
          <span>{providerName(plan.provider)}</span>
          <span className="mono text-muted">
            {shortHex(plan.provider?.address)} · {formatMon(plan.provider?.rate)}/job
          </span>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {plan.steps.map((s, i) => (
          <li key={i} className="flex gap-3 rounded-lg border border-edge bg-panel2 p-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/20 text-xs text-brand2">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{s.title}</div>
              <div className="mono mt-0.5 truncate text-muted">$ {s.command}</div>
            </div>
          </li>
        ))}
      </ol>

      {interactive && (
        <div className="mt-4 flex gap-3">
          <button onClick={onConfirm} disabled={busy} className="btn-primary flex-1">
            {busy ? <Spinner /> : "Confirm & execute"}
          </button>
          <button onClick={onReject} disabled={busy} className="btn-danger">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
