import ExecutionAttestationArtifact from "@/abis/ExecutionAttestation.json";
import ProviderRegistryArtifact from "@/abis/ProviderRegistry.json";

export const EXECUTION_ATTESTATION_ABI = ExecutionAttestationArtifact.abi;
export const PROVIDER_REGISTRY_ABI = ProviderRegistryArtifact.abi;

function addr(v: string | undefined): `0x${string}` | undefined {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : undefined;
}

export const EXECUTION_ATTESTATION_ADDRESS = addr(process.env.NEXT_PUBLIC_EXECUTION_ATTESTATION_ADDRESS);
export const PROVIDER_REGISTRY_ADDRESS = addr(process.env.NEXT_PUBLIC_PROVIDER_REGISTRY_ADDRESS);

export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.monadexplorer.com";

export function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER_URL}/address/${address}`;
}
