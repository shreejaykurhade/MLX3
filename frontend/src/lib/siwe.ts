/** Minimal EIP-4361 (Sign-In with Ethereum) message builder.
 *  The backend recovers the signer from this exact string, so the format must be stable. */
export function buildSiweMessage(opts: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
  statement?: string;
}): string {
  const statement = opts.statement ?? "Sign in to MLX3 — verifiable agent execution.";
  const issuedAt = new Date().toISOString();
  return [
    `${opts.domain} wants you to sign in with your Ethereum account:`,
    opts.address,
    "",
    statement,
    "",
    `URI: ${opts.uri}`,
    "Version: 1",
    `Chain ID: ${opts.chainId}`,
    `Nonce: ${opts.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
