"use client";

import Link from "next/link";
import type { Session } from "@/lib/types";
import { shortHex, timeAgo } from "@/lib/format";
import { StatusBadge } from "./ui";

export function SessionList({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) {
    return <p className="text-sm text-muted">No sessions yet. Start one from the Deploy page.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/audit?session=${s.id}`}
          className="group flex items-center justify-between gap-4 rounded-xl border border-edge/40 bg-panel2/40 px-5 py-4 backdrop-blur-sm transition-all duration-200 hover:border-brand/30 hover:bg-panel2/60 hover:-translate-y-0.5"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
              {s.task_type === "github" ? s.github_url : s.task_prompt}
            </div>
            <div className="mono mt-1.5 flex items-center gap-2 text-[11px] text-muted">
              <span className="rounded bg-bg/50 px-1.5 py-0.5 border border-edge/30 text-brand/80">{shortHex(s.id, 8, 6)}</span>
              <span>{timeAgo(s.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] uppercase tracking-widest text-muted">Leaves</span>
              <span className="text-xs font-mono mt-0.5">{s.leaf_count}</span>
            </div>
            <StatusBadge status={s.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
