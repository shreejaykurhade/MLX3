"use client";

import { ReactNode, useState } from "react";

/** Monospace text — use ONLY for hashes, addresses, and tx IDs (per the brand kit). */
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[13px] text-ink ${className}`}>{children}</span>;
}

export function truncateMiddle(v: string, head = 6, tail = 4): string {
  if (!v) return "";
  return v.length <= head + tail + 1 ? v : `${v.slice(0, head)}…${v.slice(-tail)}`;
}

/** Copyable monospace chip for an address / hash / tx id. */
export function MonoCopy({
  value,
  truncate = true,
  head = 6,
  tail = 4,
}: {
  value: string;
  truncate?: boolean;
  head?: number;
  tail?: number;
}) {
  const [copied, setCopied] = useState(false);
  const shown = truncate ? truncateMiddle(value, head, tail) : value;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      }}
      className="group inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 font-mono text-[13px] text-ink hover:border-line-strong"
      title="Copy"
    >
      <span className="max-w-[24ch] truncate">{shown}</span>
      <span className="text-ink-faint group-hover:text-ink">{copied ? "✓" : "⧉"}</span>
    </button>
  );
}
