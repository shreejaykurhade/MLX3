export type TaskStatus = "pending" | "running" | "verified" | "settled" | "failed";

const MAP: Record<TaskStatus, { label: string; dot: string; text: string; bg: string; pulse?: boolean }> = {
  pending: { label: "Pending", dot: "bg-st-pending", text: "text-ink-soft", bg: "bg-st-pending-soft" },
  running: { label: "Running", dot: "bg-terracotta", text: "text-terracotta-dark", bg: "bg-terracotta-soft", pulse: true },
  verified: { label: "Verified", dot: "bg-teal", text: "text-teal-dark", bg: "bg-teal-soft" },
  settled: { label: "Settled", dot: "bg-teal-dark", text: "text-teal-dark", bg: "bg-teal-soft" },
  failed: { label: "Failed", dot: "bg-st-failed", text: "text-st-failed", bg: "bg-st-failed-soft" },
};

export function StatusPill({ status }: { status: TaskStatus | string }) {
  const s = MAP[String(status).toLowerCase() as TaskStatus] ?? MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${s.pulse ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}
