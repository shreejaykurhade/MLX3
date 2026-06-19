import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Registers the deployer as a demo compute provider so the dashboard has something to
 * show before anyone else registers. Reads the contract address from
 * deployments/<network>.json (run scripts/deploy.ts first).
 *
 * Usage: npm run seed:monad
 */
async function main() {
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found at ${deploymentFile}. Run the deploy script first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf-8"));
  const registryAddress: string = deployment.contracts.ProviderRegistry;

  const [signer] = await ethers.getSigners();
  const registry = await ethers.getContractAt("ProviderRegistry", registryAddress);

  const already = await registry.isRegistered(signer.address);
  if (already) {
    console.log("Already registered as a provider:", signer.address);
    return;
  }

  const metadata = JSON.stringify({
    name: "MLX3 Demo Provider",
    endpoint: "https://demo-provider.mlx3.xyz",
    region: "us-east-1",
    gpu: "A100-80GB",
  });
  const rate = ethers.parseEther("0.001"); // 0.001 MON per job
  const stake = ethers.parseEther("0.01"); // == MIN_STAKE

  console.log("Registering provider:", signer.address);
  const tx = await registry.register(rate, metadata, { value: stake });
  const receipt = await tx.wait();

  console.log("Registered. tx:", receipt?.hash);
  console.log("Active providers:", (await registry.getProviderCount()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
