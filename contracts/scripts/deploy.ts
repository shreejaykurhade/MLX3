import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Deploys the MLX3 contracts and wires them together:
 *   1. ProviderRegistry
 *   2. ExecutionAttestation(registry)
 *   3. registry.setAttestationContract(attestation)  <- lets attestations bump job counts
 *
 * Writes the resulting addresses to deployments/<network>.json so the FastAPI backend
 * (Step 2) and the Next.js frontend (Step 3) can pick them up.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in contracts/.env before deploying to Monad."
    );
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Network:    ", network.name);
  console.log("Deployer:   ", deployer.address);
  console.log("Balance:    ", ethers.formatEther(balance), "MON");
  console.log("-----------------------------------------------------");

  // 1. ProviderRegistry
  const Registry = await ethers.getContractFactory("ProviderRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ProviderRegistry    ->", registryAddress);

  // 2. ExecutionAttestation, pointed at the registry
  const Attestation = await ethers.getContractFactory("ExecutionAttestation");
  const attestation = await Attestation.deploy(registryAddress);
  await attestation.waitForDeployment();
  const attestationAddress = await attestation.getAddress();
  console.log("ExecutionAttestation ->", attestationAddress);

  // 3. Authorize the attestation contract to record completed jobs
  const wireTx = await registry.setAttestationContract(attestationAddress);
  await wireTx.wait();
  console.log("Wired attestation -> registry (setAttestationContract)");

  // Persist the deployment for the backend / frontend to consume
  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    contracts: {
      ProviderRegistry: registryAddress,
      ExecutionAttestation: attestationAddress,
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2) + "\n");

  console.log("-----------------------------------------------------");
  console.log("Saved deployment ->", path.relative(process.cwd(), outFile));
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
