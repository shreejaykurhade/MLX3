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
    <div className="divide-y divide-edge overflow-hidden rounded-lg border border-edge">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/audit?session=${s.id}`}
          className="flex items-center justify-between gap-3 bg-panel2 px-4 py-3 hover:bg-panel"
        >
          <div className="min-w-0">
            <div className="truncate text-sm text-gray-200">
              {s.task_type === "github" ? s.github_url : s.task_prompt}
            </div>
            <div className="mono mt-0.5 text-muted">{shortHex(s.id, 8, 6)} · {timeAgo(s.created_at)}</div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-muted">{s.leaf_count} leaves</span>
            <StatusBadge status={s.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
