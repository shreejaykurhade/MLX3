import { ReactNode } from "react";

export function Card({
  className = "",
  padded = true,
  children,
}: {
  className?: string;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-card border border-line bg-white shadow-card ${padded ? "p-5" : ""} ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
