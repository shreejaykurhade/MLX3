"use client";

import { useEffect, useRef } from "react";
import type { ActionItem } from "@/lib/types";
import { shortHex } from "@/lib/format";

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  analyze_task: { icon: "◎", color: "text-brand2", label: "Analyze" },
  make_plan: { icon: "✎", color: "text-brand2", label: "Plan" },
  execute_step: { icon: "▶", color: "text-ok", label: "Execute" },
  hash_action: { icon: "#", color: "text-warn", label: "Hash" },
  build_merkle_root: { icon: "⊟", color: "text-warn", label: "Merkle" },
  submit_attestation: { icon: "⛓", color: "text-brand2", label: "Attest" },
};

export function ActionStream({ actions, logs }: { actions: ActionItem[]; logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [actions.length, logs.length]);

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Action stream</h3>
        <span className="text-xs text-muted">{actions.filter((a) => a.is_leaf).length} leaves · {actions.length} actions</span>
      </div>

      <div className="scroll-thin max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {actions.length === 0 && logs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">Waiting for the agent…</p>
        )}

        {actions.map((a) => {
          const meta = TYPE_META[a.type] || { icon: "•", color: "text-muted", label: a.type };
          const data = a.data || {};
          return (
            <div key={a.id} className="rounded-lg border border-edge bg-panel2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`${meta.color}`}>{meta.icon}</span>
                  <span className="text-sm font-medium">{a.title}</span>
                </div>
                {a.is_leaf && a.leaf_hash && (
                  <span
                    className={`mono inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${
                      a.committed ? "bg-ok/10 text-ok" : "bg-panel text-muted"
                    }`}
                    title={a.committed ? "committed to Merkle log" : "pending"}
                  >
                    {a.committed ? "✓" : "○"} {shortHex(a.leaf_hash, 8, 6)}
                  </span>
                )}
              </div>

              {a.type === "execute_step" && typeof data.stdout === "string" && (
                <pre className="scroll-thin mono mt-2 max-h-32 overflow-auto rounded bg-bg p-2 text-[11px] leading-relaxed text-gray-400">
{String(data.stdout)}
                </pre>
              )}
              {a.type === "execute_step" && (
                <div className="mt-1.5 text-xs text-muted">
                  exit {String(data.exit_code ?? 0)} · {String(data.duration_ms ?? 0)}ms
                  {data.resources ? ` · ${(data.resources as any).node}` : ""}
                </div>
              )}
            </div>
          );
        })}

        {logs.length > 0 && (
          <div className="rounded-lg border border-dashed border-edge p-3">
            <div className="label mb-1">Agent</div>
            {logs.map((l, i) => (
              <p key={i} className="text-xs text-gray-400">
                {l}
              </p>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
