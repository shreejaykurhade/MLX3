/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // We lint separately; don't block production builds on ESLint.
  eslint: { ignoreDuringBuilds: true },
  // Turbopack (used for `dev` and `build`) resolves the optional native deps that
  // WalletConnect/wagmi reference (pino-pretty, @react-native-async-storage/...) on its
  // own, so no webpack `externals` config is needed here.
};

export default nextConfig;
