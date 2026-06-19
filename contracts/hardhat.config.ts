import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const MONAD_RPC_URL = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Local in-memory chain for `npx hardhat test`.
    hardhat: {
      chainId: 31337,
    },
    // Monad testnet.
    monadTestnet: {
      url: MONAD_RPC_URL,
      chainId: 10143,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  // Contract verification on the Monad testnet explorer (Blockscout-compatible).
  // Verification is optional and not on the demo's critical path; adjust the URLs if the
  // explorer endpoint changes.
  etherscan: {
    apiKey: {
      monadTestnet: process.env.EXPLORER_API_KEY ?? "empty",
    },
    customChains: [
      {
        network: "monadTestnet",
        chainId: 10143,
        urls: {
          apiURL: "https://testnet.monadexplorer.com/api",
          browserURL: "https://testnet.monadexplorer.com",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
