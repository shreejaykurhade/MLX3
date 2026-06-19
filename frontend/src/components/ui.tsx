"use client";

import { useState } from "react";
import type { SessionStatus } from "@/lib/types";
import { shortHex } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  created: "bg-panel2 text-muted border-edge",
  planning: "bg-brand/10 text-brand2 border-brand/40",
  awaiting_confirmation: "bg-warn/10 text-warn border-warn/40",
  executing: "bg-brand/10 text-brand2 border-brand/40",
  completed: "bg-ok/10 text-ok border-ok/40",
  rejected: "bg-panel2 text-muted border-edge",
  failed: "bg-bad/10 text-bad border-bad/40",
};

const STATUS_LABEL: Record<string, string> = {
  created: "Created",
  planning: "Planning",
  awaiting_confirmation: "Awaiting confirmation",
  executing: "Executing",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Failed",
};

export function StatusBadge({ status }: { status?: SessionStatus | string | null }) {
  const s = status || "created";
  const animate = s === "planning" || s === "executing";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[s] || STATUS_STYLES.created
      }`}
    >
      {animate && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {STATUS_LABEL[s] || s}
    </span>
  );
}

export function HashChip({ value, href, label }: { value?: string | null; href?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-muted">—</span>;

  const text = label || shortHex(value, 10, 8);
  const inner = (
    <span className="mono inline-flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 text-gray-300">{text}</span>
  );

  return (
    <span className="inline-flex items-center gap-1">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-brand2">
          {inner}
        </a>
      ) : (
        inner
      )}
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        }}
        className="text-muted hover:text-white"
        title="Copy"
      >
        {copied ? "✓" : "⧉"}
      </button>
    </span>
  );
}

export function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-edge border-t-brand" aria-hidden />
  );
}
