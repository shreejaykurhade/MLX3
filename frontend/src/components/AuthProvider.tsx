"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { api } from "@/lib/api";
import { buildSiweMessage } from "@/lib/siwe";
import { monadTestnet } from "@/lib/wagmi";

interface AuthCtx {
  signedIn: boolean;
  address?: string;
  signingIn: boolean;
  error?: string;
  signIn: () => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>({
  signedIn: false,
  signingIn: false,
  signIn: async () => {},
  signOut: () => {},
});

const STORAGE_KEY = "mlx3_siwe_address";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [signedAddr, setSignedAddr] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSignedAddr(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const signedIn = !!address && !!signedAddr && signedAddr.toLowerCase() === address.toLowerCase();

  async function signIn() {
    if (!address) return;
    setSigningIn(true);
    setError(undefined);
    try {
      const { nonce } = await api.nonce();
      const message = buildSiweMessage({
        domain: window.location.host,
        address,
        uri: window.location.origin,
        chainId: monadTestnet.id,
        nonce,
      });
      const signature = await signMessageAsync({ message });
      const res = await api.verify({ address, message, signature });
      if (!res.ok) throw new Error("verification failed");
      window.localStorage.setItem(STORAGE_KEY, address);
      setSignedAddr(address);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "sign-in failed");
    } finally {
      setSigningIn(false);
    }
  }

  function signOut() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSignedAddr(null);
  }

  return <Ctx.Provider value={{ signedIn, address, signingIn, error, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
