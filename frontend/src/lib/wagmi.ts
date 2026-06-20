import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143");
const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadexplorer.com";

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Monad Explorer", url: EXPLORER_URL } },
  testnet: true,
});

export const config = getDefaultConfig({
  appName: "MLX3",
  // Injected wallets work without a real id; set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  // to enable the WalletConnect modal.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "mlx3_demo_walletconnect_id",
  chains: [monadTestnet],
  ssr: true,
});
