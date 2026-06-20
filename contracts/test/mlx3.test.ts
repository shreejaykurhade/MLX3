import { expect } from "chai";
import { ethers } from "hardhat";
import { createHash } from "crypto";

// --------------------------------------------------------------------------- //
//  Reference SHA-256 Merkle tree (mirrors the Solidity processProof and the
//  Python/TS builders used later). Internal node = SHA-256(left ++ right),
//  odd levels duplicate the last node, proofs are sibling hashes bottom-up.
// --------------------------------------------------------------------------- //

function sha256(buf: Buffer): Buffer {
  return createHash("sha256").update(buf).digest();
}

/** SHA-256 of a UTF-8 string -> 32-byte leaf (stand-in for hashing an action). */
function leafHash(s: string): Buffer {
  return sha256(Buffer.from(s, "utf-8"));
}

/** Build every level of the tree, bottom (leaves) to top (root). */
function buildLevels(leaves: Buffer[]): Buffer[][] {
  if (leaves.length === 0) throw new Error("no leaves");
  const levels: Buffer[][] = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i]; // duplicate last
      next.push(sha256(Buffer.concat([left, right])));
    }
    levels.push(next);
    current = next;
  }
  return levels;
}

function merkleRoot(leaves: Buffer[]): Buffer {
  const levels = buildLevels(leaves);
  return levels[levels.length - 1][0];
}

/** Sibling hashes from the given leaf index up to the root. */
function merkleProof(leaves: Buffer[], index: number): Buffer[] {
  const levels = buildLevels(leaves);
  const proof: Buffer[] = [];
  let idx = index;
  for (let level = 0; level < levels.length - 1; level++) {
    const nodes = levels[level];
    const siblingIndex = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = siblingIndex < nodes.length ? nodes[siblingIndex] : nodes[idx]; // self
    proof.push(sibling);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

const hex = (b: Buffer) => "0x" + b.toString("hex");
const randomSessionId = () => ethers.hexlify(ethers.randomBytes(32));

describe("MLX3 contracts", () => {
  async function deploy() {
    const [deployer, provider, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ProviderRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();

    const Attestation = await ethers.getContractFactory("ExecutionAttestation");
    const attestation = await Attestation.deploy(await registry.getAddress());
    await attestation.waitForDeployment();

    await (await registry.setAttestationContract(await attestation.getAddress())).wait();

    return { registry, attestation, deployer, provider, other };
  }

  describe("ProviderRegistry", () => {
    it("registers a provider with sufficient stake", async () => {
      const { registry, provider } = await deploy();
      const rate = ethers.parseEther("0.001");
      await expect(
        registry.connect(provider).register(rate, '{"name":"P1"}', {
          value: ethers.parseEther("0.01"),
        })
      ).to.emit(registry, "ProviderRegistered");

      expect(await registry.isRegistered(provider.address)).to.equal(true);
      expect(await registry.getProviderCount()).to.equal(1n);

      const active = await registry.getActiveProviders();
      expect(active.length).to.equal(1);
      expect(active[0].rate).to.equal(rate);
      expect(active[0].jobsCompleted).to.equal(0n);
    });

    it("rejects registration below MIN_STAKE", async () => {
      const { registry, provider } = await deploy();
      await expect(
        registry.connect(provider).register(0, "{}", { value: ethers.parseEther("0.001") })
      ).to.be.revertedWith("insufficient stake");
    });

    it("only the attestation contract can record jobs", async () => {
      const { registry, provider, other } = await deploy();
      await registry
        .connect(provider)
        .register(0, "{}", { value: ethers.parseEther("0.01") });
      await expect(
        registry.connect(other).recordJob(provider.address)
      ).to.be.revertedWith("only attestation");
    });

    it("refunds stake on deregister", async () => {
      const { registry, provider } = await deploy();
      await registry
        .connect(provider)
        .register(0, "{}", { value: ethers.parseEther("0.01") });
      await expect(registry.connect(provider).deregister()).to.emit(
        registry,
        "ProviderDeregistered"
      );
      expect(await registry.isRegistered(provider.address)).to.equal(false);
    });
  });

  describe("ExecutionAttestation", () => {
    it("stores an attestation and bumps the provider job counter", async () => {
      const { registry, attestation, deployer, provider } = await deploy();
      await registry
        .connect(provider)
        .register(0, "{}", { value: ethers.parseEther("0.01") });

      const leaves = ["action-0", "action-1", "action-2"].map(leafHash);
      const root = hex(merkleRoot(leaves));
      const sessionId = randomSessionId();

      await expect(
        attestation.submitAttestation(sessionId, root, provider.address, leaves.length)
      )
        .to.emit(attestation, "AttestationSubmitted")
        .and.to.emit(registry, "JobRecorded");

      const att = await attestation.getAttestation(sessionId);
      expect(att.merkleRoot).to.equal(root);
      expect(att.agent).to.equal(deployer.address);
      expect(att.provider).to.equal(provider.address);
      expect(att.leafCount).to.equal(3n);

      expect((await registry.getProvider(provider.address)).jobsCompleted).to.equal(1n);
    });

    it("cannot overwrite an existing session", async () => {
      const { attestation, provider } = await deploy();
      const sessionId = randomSessionId();
      const root = hex(merkleRoot([leafHash("a")]));
      await attestation.submitAttestation(sessionId, root, provider.address, 1);
      await expect(
        attestation.submitAttestation(sessionId, root, provider.address, 1)
      ).to.be.revertedWith("session exists");
    });

    // The crux: the off-chain SHA-256 tree must verify against the on-chain processProof
    // for EVERY leaf, including odd-sized trees (which duplicate the last node).
    for (const n of [1, 2, 3, 5, 8, 9]) {
      it(`verifies every leaf of a ${n}-leaf tree on-chain`, async () => {
        const { attestation, provider } = await deploy();
        const leaves = Array.from({ length: n }, (_, i) => leafHash(`action-${i}`));
        const root = hex(merkleRoot(leaves));
        const sessionId = randomSessionId();
        await attestation.submitAttestation(sessionId, root, provider.address, n);

        for (let i = 0; i < n; i++) {
          const proof = merkleProof(leaves, i).map(hex);
          expect(
            await attestation.verify(sessionId, hex(leaves[i]), proof, i),
            `leaf ${i} should verify`
          ).to.equal(true);
        }
      });
    }

    it("rejects a tampered leaf", async () => {
      const { attestation, provider } = await deploy();
      const leaves = ["a", "b", "c", "d"].map(leafHash);
      const root = hex(merkleRoot(leaves));
      const sessionId = randomSessionId();
      await attestation.submitAttestation(sessionId, root, provider.address, 4);

      const proof = merkleProof(leaves, 1).map(hex);
      const tampered = hex(leafHash("not-b"));
      expect(await attestation.verify(sessionId, tampered, proof, 1)).to.equal(false);
    });

    it("returns false for an unknown session", async () => {
      const { attestation } = await deploy();
      const leaf = hex(leafHash("x"));
      expect(await attestation.verify(randomSessionId(), leaf, [], 0)).to.equal(false);
    });
  });
});
