"use client";

import type { Provider } from "@/lib/types";
import { formatMon, providerName, shortHex } from "@/lib/format";

export function ProviderList({ providers, onChain }: { providers: Provider[]; onChain: boolean }) {
  if (!providers.length) {
    return <p className="text-sm text-muted">No active providers.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {providers.map((p) => {
        const meta = (p.metadata || {}) as any;
        return (
          <div key={p.address} className="rounded-lg border border-edge bg-panel2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{providerName(p)}</span>
              <span className="mono text-muted">{shortHex(p.address)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="label">Rate</div>
                <div>{formatMon(p.rate)}</div>
              </div>
              <div>
                <div className="label">Stake</div>
                <div>{formatMon(p.stake)}</div>
              </div>
              <div>
                <div className="label">Jobs</div>
                <div>{p.jobs_completed}</div>
              </div>
            </div>
            {(meta.region || meta.gpu) && (
              <div className="mt-2 text-xs text-muted">
                {[meta.gpu, meta.region].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
