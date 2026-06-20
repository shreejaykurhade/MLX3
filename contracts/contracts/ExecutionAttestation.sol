// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IProviderRegistry {
    function recordJob(address provider) external;
}

/// @title ExecutionAttestation
/// @notice Commits a Merkle root over an AI agent's action log for a given session, so
///         anyone can later prove that a specific action (leaf) was part of the attested
///         execution. The root is stored alongside the agent, the chosen provider, a
///         timestamp and the number of leaves, and an event is emitted for indexers.
///
/// @dev    Merkle scheme (MUST match the off-chain Python builder and the TypeScript
///         verifier on the audit page):
///           - leaf        = SHA-256(canonical_json(action))   [computed off-chain]
///           - parent(a,b) = SHA-256(a ++ b)                   [32-byte || 32-byte]
///           - odd level   : the last node is duplicated (paired with itself)
///           - proof       : sibling hash at each level, bottom-up
///           - index       : the leaf's position in the original action ordering,
///                           used to decide left/right at each level
///         SHA-256 (rather than keccak256) is used throughout so the exact same tree can
///         be reproduced in Python (`hashlib.sha256`) and JS (`crypto`/`noble-hashes`).
contract ExecutionAttestation {
    struct Attestation {
        bytes32 merkleRoot;
        address agent;      // wallet that ran the agent and submitted the root
        address provider;   // provider selected from ProviderRegistry
        uint256 timestamp;  // block timestamp of submission (0 == not attested)
        uint256 leafCount;  // number of actions in the log
    }

    /// @notice Registry used to bump a provider's job counter on submission. May be the
    ///         zero address, in which case job recording is skipped.
    IProviderRegistry public immutable registry;

    /// @notice sessionId => attestation. `sessionId` is a bytes32 derived off-chain from
    ///         the backend session id (keccak256 of the UUID string).
    mapping(bytes32 => Attestation) public attestations;
    bytes32[] public sessionIds;

    event AttestationSubmitted(
        bytes32 indexed sessionId,
        bytes32 merkleRoot,
        address indexed agent,
        address indexed provider,
        uint256 leafCount,
        uint256 timestamp
    );

    constructor(address _registry) {
        registry = IProviderRegistry(_registry);
    }

    /// @notice Submit the Merkle root committing to a completed session's action log.
    /// @param sessionId  bytes32 session identifier (unique; cannot be overwritten).
    /// @param merkleRoot Root of the SHA-256 Merkle tree over the action leaves.
    /// @param provider   Provider that ran the job (its job counter is incremented).
    /// @param leafCount  Number of actions / leaves in the tree.
    function submitAttestation(
        bytes32 sessionId,
        bytes32 merkleRoot,
        address provider,
        uint256 leafCount
    ) external {
        require(attestations[sessionId].timestamp == 0, "session exists");
        require(merkleRoot != bytes32(0), "empty root");

        attestations[sessionId] = Attestation({
            merkleRoot: merkleRoot,
            agent: msg.sender,
            provider: provider,
            timestamp: block.timestamp,
            leafCount: leafCount
        });
        sessionIds.push(sessionId);

        // Best-effort: bump the provider's on-chain completed-jobs counter.
        if (provider != address(0) && address(registry) != address(0)) {
            registry.recordJob(provider);
        }

        emit AttestationSubmitted(sessionId, merkleRoot, msg.sender, provider, leafCount, block.timestamp);
    }

    /// @notice Verify that `leaf` is included in the attested root for `sessionId`.
    /// @param sessionId The session whose root to check against.
    /// @param leaf      SHA-256 hash of a canonicalized action (computed off-chain).
    /// @param proof     Sibling hashes from the leaf up to the root.
    /// @param index     The leaf's position index in the original action ordering.
    /// @return ok       True if the proof reconstructs the stored root.
    function verify(
        bytes32 sessionId,
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool ok) {
        Attestation storage att = attestations[sessionId];
        if (att.timestamp == 0) {
            return false;
        }
        return processProof(leaf, proof, index) == att.merkleRoot;
    }

    /// @notice Recompute a Merkle root from a leaf and its proof using position-aware
    ///         SHA-256 hashing. Pure, so it can be used independently of stored state.
    function processProof(
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index
    ) public pure returns (bytes32) {
        bytes32 computed = leaf;
        uint256 idx = index;
        for (uint256 i = 0; i < proof.length; i++) {
            if (idx % 2 == 0) {
                // current node is a left child -> sibling on the right
                computed = sha256(abi.encodePacked(computed, proof[i]));
            } else {
                // current node is a right child -> sibling on the left
                computed = sha256(abi.encodePacked(proof[i], computed));
            }
            idx /= 2;
        }
        return computed;
    }

    // --------------------------------------------------------------------- //
    //                              Views                                     //
    // --------------------------------------------------------------------- //

    function getAttestation(bytes32 sessionId) external view returns (Attestation memory) {
        return attestations[sessionId];
    }

    function isAttested(bytes32 sessionId) external view returns (bool) {
        return attestations[sessionId].timestamp != 0;
    }

    function getSessionCount() external view returns (uint256) {
        return sessionIds.length;
    }
}
