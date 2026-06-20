"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Copyable, HashChip, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { addressUrl } from "@/lib/contracts";
import { formatMon, shortHex } from "@/lib/format";
import { monadTestnet } from "@/lib/wagmi";
import type { BackendConfig } from "@/lib/types";

// Fallbacks if the backend isn't reachable — keep the page useful regardless.
const FALLBACK = {
  chain_id: monadTestnet.id,
  network_name: monadTestnet.name,
  rpc_url: monadTestnet.rpcUrls.default.http[0],
  explorer_url: monadTestnet.blockExplorers?.default.url ?? "https://testnet.monadexplorer.com",
  currency_symbol: monadTestnet.nativeCurrency.symbol,
  faucet_url: "https://faucet.monad.xyz/",
};

export default function SetupPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: monadTestnet.id });
  const [cfg, setCfg] = useState<BackendConfig | null>(null);

  useEffect(() => {
    api.getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  const net = cfg?.chain ?? FALLBACK;
  const faucetUrl = net.faucet_url;
  const agent = cfg?.agent;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Testnet setup</h1>
        <p className="mt-1 text-sm text-muted">
          MLX3 runs on <span className="text-brand">Monad testnet</span>. Get free test MON, point your wallet at the
          network, and (optionally) enable real on-chain attestations. Test tokens have no real value — you claim them
          for free from a faucet.
        </p>
      </div>

      {/* Step 1 — add network */}
      <Step n={1} title="Add Monad Testnet to your wallet">
        <div className="flex flex-wrap items-center gap-3">
          {isConnected ? <NetworkStatus /> : <ConnectButton />}
        </div>
        <p className="mt-4 text-xs text-muted">Or add it manually in MetaMask → Add network → Add manually:</p>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="Network name" value={net.network_name} />
          <Field label="Chain ID" value={String(net.chain_id)} />
          <Field label="RPC URL" value={net.rpc_url} />
          <Field label="Currency symbol" value={net.currency_symbol} />
          <Field label="Block explorer" value={net.explorer_url} />
          <Field label="Chain ID (hex)" value={cfg?.chain.chain_id_hex ?? "0x279f"} />
        </dl>
      </Step>

      {/* Step 2 — faucet */}
      <Step n={2} title="Get free testnet MON from the faucet">
        {!isConnected ? (
          <p className="text-sm text-muted">Connect your wallet to see your address and balance.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="label">Your wallet</div>
                <div className="mt-1">
                  <Copyable value={address!} />
                </div>
              </div>
              <div>
                <div className="label">Balance</div>
                <div className="mt-1 text-lg font-semibold">
                  {balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : "—"}
                </div>
              </div>
            </div>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-gray-300">
              <li>Copy your wallet address above.</li>
              <li>Open the faucet, paste it in, and complete the captcha / social check.</li>
              <li>Click claim — your balance updates within a few seconds.</li>
            </ol>
            <a href={faucetUrl} target="_blank" rel="noreferrer" className="btn-primary mt-4">
              Open Monad faucet →
            </a>
          </>
        )}
      </Step>

      {/* Step 3 — enable real attestations */}
      <Step n={3} title="Enable real on-chain attestations (backend)">
        <p className="text-sm text-muted">
          By default the backend <em>simulates</em> the attestation tx. To submit it for real, the backend needs a
          funded signer (the <strong>agent wallet</strong>) and the deployed contract addresses.
        </p>

        <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
          ⚠ Use a dedicated <strong>testnet-only</strong> wallet for the agent key. Never put a private key that holds
          real funds (or controls a mainnet account) into <code className="mono">.env</code>.
        </div>

        {cfg ? (
          <div className="mt-4 rounded-lg border border-edge bg-panel2 p-4">
            <div className="flex items-center justify-between">
              <span className="label">Backend status</span>
              {agent?.write_enabled ? (
                <span className="rounded-full border border-ok/50 bg-ok/10 px-2.5 py-0.5 text-xs text-ok">
                  Real attestations enabled ✓
                </span>
              ) : (
                <span className="rounded-full border border-warn/50 bg-warn/10 px-2.5 py-0.5 text-xs text-warn">
                  Simulating
                </span>
              )}
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Agent wallet">
                {agent?.address ? (
                  <span className="flex items-center gap-2">
                    <HashChip value={agent.address} href={addressUrl(agent.address)} />
                    {address && agent.address.toLowerCase() === address.toLowerCase() && (
                      <span className="text-xs text-ok">= your wallet</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted">not configured</span>
                )}
              </Row>
              <Row label="Agent balance">
                <span>{agent?.balance_wei != null ? formatMon(agent.balance_wei) : "—"}</span>
              </Row>
              <Row label="ExecutionAttestation">
                {cfg.contracts.execution_attestation ? (
                  <HashChip
                    value={cfg.contracts.execution_attestation}
                    href={addressUrl(cfg.contracts.execution_attestation)}
                  />
                ) : (
                  <span className="text-muted">not deployed</span>
                )}
              </Row>
              <Row label="Agent model">
                <span className="text-gray-300">{cfg.mode.agent}</span>
              </Row>
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Backend not reachable — start it to see live status.</p>
        )}

        {!agent?.write_enabled && (
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-gray-300">
            <li>Fund a wallet with MON (Step 2). This becomes the agent signer.</li>
            <li>
              Deploy the contracts: <code className="mono">cd contracts &amp;&amp; npm run deploy:monad</code> (writes{" "}
              <code className="mono">deployments/monadTestnet.json</code>).
            </li>
            <li>
              In <code className="mono">backend/.env</code>, set <code className="mono">AGENT_PRIVATE_KEY</code> to that
              wallet&apos;s key (MetaMask → ⋮ → Account details → Show private key). Contract addresses load
              automatically from the deployment file.
            </li>
            <li>
              Restart the backend (<code className="mono">./run.sh</code>). The next run signs a live tx with a real
              hash on {net.network_name}.
            </li>
          </ol>
        )}
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/20 text-sm text-brand2">{n}</span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-1">
        <Copyable value={value} />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="label">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
