"use client";

import type { Provider } from "@/lib/types";
import { formatMon, providerName, shortHex } from "@/lib/format";

export function ProviderList({ providers, onChain }: { providers: Provider[]; onChain: boolean }) {
  if (!providers.length) {
    return <p className="text-sm text-muted">No active providers.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
      {providers.map((p) => {
        const meta = (p.metadata || {}) as any;
        return (
          <div key={p.address} className="group relative rounded-xl border border-edge/50 bg-panel2/30 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:bg-panel2/50 hover:shadow-[0_4px_20px_rgba(131,110,249,0.1)] overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="h-2 w-2 rounded-full bg-brand shadow-[0_0_8px_rgba(131,110,249,0.8)]"></div>
            </div>
            <div className="flex items-center justify-between pr-4">
              <span className="font-semibold text-gray-100">{providerName(p)}</span>
              <span className="mono text-muted">{shortHex(p.address)}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-bg/50 p-2 text-center border border-edge/30">
                <div className="text-[10px] uppercase tracking-widest text-muted">Rate</div>
                <div className="mt-1 font-medium">{formatMon(p.rate)}</div>
              </div>
              <div className="rounded-lg bg-bg/50 p-2 text-center border border-edge/30">
                <div className="text-[10px] uppercase tracking-widest text-muted">Stake</div>
                <div className="mt-1 font-medium">{formatMon(p.stake)}</div>
              </div>
              <div className="rounded-lg bg-bg/50 p-2 text-center border border-edge/30">
                <div className="text-[10px] uppercase tracking-widest text-muted">Jobs</div>
                <div className="mt-1 font-medium">{p.jobs_completed}</div>
              </div>
            </div>
            {(meta.region || meta.gpu) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                {meta.gpu && <span className="rounded bg-panel px-1.5 py-0.5 border border-edge/40">{meta.gpu}</span>}
                {meta.region && <span className="rounded bg-panel px-1.5 py-0.5 border border-edge/40">{meta.region}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
