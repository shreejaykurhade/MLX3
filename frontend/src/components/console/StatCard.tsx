import { ReactNode } from "react";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "terracotta" | "teal";
}) {
  const valueColor =
    tone === "terracotta" ? "text-terracotta" : tone === "teal" ? "text-teal" : "text-ink";
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-2 font-display text-[26px] font-semibold leading-none ${valueColor}`}>{value}</p>
      {hint && <p className="mt-2 text-[13px] text-ink-soft">{hint}</p>}
    </Card>
  );
}
