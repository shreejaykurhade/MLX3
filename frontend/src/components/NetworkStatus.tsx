"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { monadTestnet } from "@/lib/wagmi";

/** Add-or-switch the connected wallet to Monad testnet. wagmi triggers
 *  wallet_addEthereumChain automatically when the chain isn't in the wallet. */
export function NetworkStatus({ compact = false }: { compact?: boolean }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!isConnected) return null;

  const onMonad = chainId === monadTestnet.id;

  if (onMonad) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-ok">
        <span className="h-2 w-2 rounded-full bg-ok" /> On {monadTestnet.name}
      </span>
    );
  }

  return (
    <div className={compact ? "" : "space-y-1"}>
      <button onClick={() => switchChain({ chainId: monadTestnet.id })} disabled={isPending} className="btn-primary">
        {isPending ? "Confirm in wallet…" : `Add / switch to ${monadTestnet.name}`}
      </button>
      {error && !compact && <p className="text-xs text-bad">{error.message}</p>}
    </div>
  );
}
