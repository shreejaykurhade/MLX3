"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/components/AuthProvider";
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
    <div className="space-y-8">
      <section className="rounded-2xl border border-edge bg-gradient-to-br from-panel to-bg p-8">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight">
          Verifiable agent execution on <span className="text-brand">Monad</span>
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Submit a task, an AI agent plans and executes it, every action is SHA-256 hashed into a Merkle tree, and the
          root is committed on-chain — so anyone can verify exactly what the agent did.
        </p>
        <div className="mt-5">
          {!isConnected ? (
            <ConnectButton />
          ) : !signedIn ? (
            <button onClick={signIn} disabled={signingIn} className="btn-primary">
              {signingIn ? "Signing…" : "Sign in with Ethereum"}
            </button>
          ) : (
            <Link href="/deploy" className="btn-primary">
              New deployment →
            </Link>
          )}
          {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Compute providers</h2>
          <span className="text-xs text-muted">{onChain ? "live from ProviderRegistry" : "default (registry not deployed)"}</span>
        </div>
        {providers === null ? <Spinner /> : <ProviderList providers={providers} onChain={onChain} />}
      </section>

      {isConnected && signedIn && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Your recent sessions</h2>
          {sessions === null ? <Spinner /> : <SessionList sessions={sessions} />}
        </section>
      )}
    </div>
  );
}
