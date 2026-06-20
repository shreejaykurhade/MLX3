"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/components/AuthProvider";
import { NetworkStatus } from "@/components/NetworkStatus";
import { ProviderList } from "@/components/ProviderList";
import { SessionList } from "@/components/SessionList";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Provider, Session } from "@/lib/types";

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { signedIn, signIn, signingIn, error } = useAuth();

  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [onChain, setOnChain] = useState(false);
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    api.getProviders().then((r) => {
      setProviders(r.providers);
      setOnChain(r.on_chain);
    }).catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!signedIn || !address) return;
    api.listSessions(address).then((r) => setSessions(r.sessions)).catch(() => setSessions([]));
  }, [signedIn, address]);

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Hero Bento - spans 2 columns */}
      <section className="bento-card md:col-span-2 lg:col-span-2 relative z-10 flex flex-col justify-between">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-bg/0 to-bg/0 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl font-semibold tracking-tight">
            Verifiable agent execution on <span className="text-brand font-bold">Monad</span>
          </h1>
          <p className="mt-3 text-muted max-w-xl leading-relaxed">
            Submit a task, an AI agent plans and executes it, every action is SHA-256 hashed into a Merkle tree, and the
            root is committed on-chain — so anyone can verify exactly what the agent did.
          </p>
        </div>
        
        <div className="relative z-10 mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {!isConnected ? (
            <ConnectButton />
          ) : !signedIn ? (
            <button onClick={signIn} disabled={signingIn} className="btn-primary shadow-[0_0_20px_rgba(131,110,249,0.3)]">
              {signingIn ? "Signing…" : "Sign in with Ethereum"}
            </button>
          ) : (
            <Link href="/deploy" className="btn-primary shadow-[0_0_20px_rgba(131,110,249,0.3)] px-6 py-3 text-base">
              New deployment →
            </Link>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
      </section>

      {/* Network / Status Bento - spans 1 column */}
      <section className="bento-card flex flex-col justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">Network Status</h2>
          <div className="mt-4 p-4 rounded-xl bg-bg/50 border border-edge/50">
            {isConnected ? (
              <NetworkStatus compact />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted">
                <div className="h-2 w-2 rounded-full bg-bad/50"></div>
                Not connected
              </div>
            )}
          </div>
        </div>
        {isConnected && (
          <div className="mt-6 border-t border-edge/50 pt-4">
            <Link href="/setup" className="group flex items-center justify-between text-sm text-brand hover:text-brand2 transition-colors">
              <span>Need testnet MON?</span>
              <span className="transform transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        )}
      </section>

      {/* Providers Bento - spans 2 columns */}
      <section className="bento-card md:col-span-2 flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-ok animate-pulse"></div>
            <h2 className="text-lg font-semibold tracking-tight">Compute Network</h2>
          </div>
          <span className="rounded-full bg-panel px-3 py-1 text-[10px] uppercase tracking-wider text-muted border border-edge">
            {onChain ? "Live" : "Default"}
          </span>
        </div>
        <div className="flex-1">
          {providers === null ? (
            <div className="flex h-32 items-center justify-center"><Spinner /></div>
          ) : (
            <ProviderList providers={providers} onChain={onChain} />
          )}
        </div>
      </section>

      {/* Sessions Bento - spans 1 column or stretches */}
      {isConnected && signedIn && (
        <section className="bento-card md:col-span-2 lg:col-span-1 flex flex-col max-h-[400px]">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Recent Sessions</h2>
          <div className="flex-1 overflow-y-auto scroll-thin pr-2">
            {sessions === null ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : sessions.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-edge/50 text-center">
                <span className="text-muted text-sm mb-2">No history</span>
                <Link href="/deploy" className="text-brand text-xs hover:underline">Start a task</Link>
              </div>
            ) : (
              <SessionList sessions={sessions} />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
