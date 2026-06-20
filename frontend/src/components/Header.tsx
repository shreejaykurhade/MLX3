"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { useAuth } from "./AuthProvider";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/deploy", label: "Deploy" },
  { href: "/audit", label: "Audit" },
  { href: "/setup", label: "Setup" },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const { signedIn, signIn, signingIn } = useAuth();

  return (
    <header className="border-b border-edge bg-panel/60 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand font-bold text-white">M</span>
            <span className="text-lg font-semibold tracking-tight">
              MLX<span className="text-brand">3</span>
            </span>
          </a>
          <nav className="hidden gap-1 sm:flex">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    active ? "bg-panel2 text-white" : "text-muted hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && !signedIn && (
            <button onClick={signIn} disabled={signingIn} className="btn-ghost">
              {signingIn ? "Signing…" : "Sign in"}
            </button>
          )}
          {isConnected && signedIn && (
            <span className="hidden items-center gap-1.5 text-xs text-ok sm:flex">
              <span className="h-2 w-2 rounded-full bg-ok" /> signed in
            </span>
          )}
          <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
        </div>
      </div>
    </header>
  );
}
