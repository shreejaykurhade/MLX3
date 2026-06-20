"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/AuthProvider";
import { ActionStream } from "@/components/ActionStream";
import { CompletionPanel } from "@/components/CompletionPanel";
import { PlanCard } from "@/components/PlanCard";
import { TaskForm, type TaskInput } from "@/components/TaskForm";
import { StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { useSessionStream } from "@/lib/useSessionStream";

export default function DeployPage() {
  const { address, isConnected } = useAccount();
  const { signedIn, signIn, signingIn } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const stream = useSessionStream(sessionId);

  async function submit(t: TaskInput) {
    if (!address) return;
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const s = await api.createSession({ wallet_address: address, ...t });
      setSessionId(s.id);
    } catch (e: any) {
      setSubmitError(e?.message || "failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm(confirmed: boolean) {
    if (!sessionId) return;
    setConfirming(true);
    try {
      await api.confirm(sessionId, confirmed);
    } catch (e) {
      /* surfaced via stream/error */
    } finally {
      setConfirming(false);
    }
  }

  if (!isConnected || !signedIn) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <h2 className="text-lg font-semibold">Sign in to deploy</h2>
        <p className="mt-1 text-sm text-muted">Connect your wallet and sign in to submit a task.</p>
        <div className="mt-4 flex justify-center">
          {!isConnected ? (
            <ConnectButton />
          ) : (
            <button onClick={signIn} disabled={signingIn} className="btn-primary">
              {signingIn ? "Signing…" : "Sign in with Ethereum"}
            </button>
          )}
        </div>
      </div>
    );
  }

  const awaiting = stream.status === "awaiting_confirmation";
  const rejected = stream.status === "rejected";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deploy a task</h1>
        {sessionId && <StatusBadge status={stream.status} />}
      </div>

      {!sessionId ? (
        <div className="mx-auto max-w-xl">
          <TaskForm disabled={submitting} onSubmit={submit} />
          {submitError && <p className="mt-3 text-sm text-bad">{submitError}</p>}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {stream.plan && (
              <PlanCard
                plan={stream.plan}
                onConfirm={awaiting ? () => confirm(true) : undefined}
                onReject={awaiting ? () => confirm(false) : undefined}
                busy={confirming}
              />
            )}
            {stream.completion && (
              <CompletionPanel
                sessionId={sessionId}
                merkleRoot={stream.completion.merkle_root}
                txHash={stream.completion.attestation_tx}
                simulated={stream.completion.simulated}
                explorerUrl={stream.completion.explorer_url}
                leafCount={stream.completion.leaf_count}
              />
            )}
            {rejected && (
              <div className="card border-edge text-sm text-muted">Plan rejected. Start a new task from above.</div>
            )}
            {stream.error && <div className="card border-bad/40 text-sm text-bad">Error: {stream.error}</div>}
            {!sessionId ? null : (
              <button onClick={() => setSessionId(null)} className="btn-ghost">
                ← New task
              </button>
            )}
          </div>

          <ActionStream actions={stream.actions} logs={stream.logs} />
        </div>
      )}
    </div>
  );
}
