"""SHA-256 binary Merkle tree utilities for MLX3.

This MUST stay byte-for-byte compatible with:
  - the Solidity verifier  (contracts/ExecutionAttestation.sol  -> processProof)
  - the TypeScript verifier (frontend audit page, Step 3)

Scheme:
  - leaf        = SHA-256(canonical_json(action))     (computed once, stored as hex)
  - parent(a,b) = SHA-256(a || b)                      (two 32-byte digests concatenated)
  - odd level   : the last node is duplicated (paired with itself)
  - proof       : sibling hash at each level, bottom-up
  - index       : the leaf's position in the original ordering (decides left/right)

Run `python -m app.merkle` for a self-test over tree sizes 1,2,3,5,8,9 (mirrors
contracts/test/mlx3.test.ts).
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, List


# --------------------------------------------------------------------------- #
#  Leaf derivation (must match the TypeScript audit page)
# --------------------------------------------------------------------------- #

def canonical_action(session_id: str, leaf_index: int, action_type: str, title: str, data: Any) -> str:
    """Deterministic JSON string for an action. The exact bytes hashed into a leaf.

    Sorted keys + compact separators so Python and JS produce identical output.
    The full string is stored alongside the leaf hash so the audit page can verify
    `sha256(canonical) == leaf_hash` without re-deriving the canonical form.
    """
    obj = {
        "session_id": session_id,
        "leaf_index": leaf_index,
        "type": action_type,
        "title": title,
        "data": data,
    }
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_bytes(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def leaf_hash_hex(canonical: str) -> str:
    """0x-prefixed SHA-256 hex of a canonical action string (the Merkle leaf)."""
    return "0x" + sha256_bytes(canonical.encode("utf-8")).hex()


# --------------------------------------------------------------------------- #
#  Tree construction
# --------------------------------------------------------------------------- #

def _pair(left: bytes, right: bytes) -> bytes:
    return sha256_bytes(left + right)


def build_levels(leaves: List[bytes]) -> List[List[bytes]]:
    """Return every level of the tree, bottom (leaves) to top (root)."""
    if not leaves:
        raise ValueError("cannot build a Merkle tree with no leaves")
    levels: List[List[bytes]] = [list(leaves)]
    current = leaves
    while len(current) > 1:
        nxt: List[bytes] = []
        for i in range(0, len(current), 2):
            left = current[i]
            right = current[i + 1] if i + 1 < len(current) else current[i]  # duplicate last
            nxt.append(_pair(left, right))
        levels.append(nxt)
        current = nxt
    return levels


def merkle_root(leaves: List[bytes]) -> bytes:
    return build_levels(leaves)[-1][0]


def merkle_proof(leaves: List[bytes], index: int) -> List[bytes]:
    """Sibling hashes from the given leaf index up to the root."""
    if index < 0 or index >= len(leaves):
        raise IndexError("leaf index out of range")
    levels = build_levels(leaves)
    proof: List[bytes] = []
    idx = index
    for level in range(len(levels) - 1):
        nodes = levels[level]
        sibling_index = idx + 1 if idx % 2 == 0 else idx - 1
        sibling = nodes[sibling_index] if sibling_index < len(nodes) else nodes[idx]  # self
        proof.append(sibling)
        idx //= 2
    return proof


def verify_proof(leaf: bytes, proof: List[bytes], index: int, root: bytes) -> bool:
    """Recompute the root from a leaf + proof (position-aware SHA-256) and compare."""
    computed = leaf
    idx = index
    for sibling in proof:
        if idx % 2 == 0:
            computed = _pair(computed, sibling)
        else:
            computed = _pair(sibling, computed)
        idx //= 2
    return computed == root


# --------------------------------------------------------------------------- #
#  Hex helpers (for crossing the API / contract boundary)
# --------------------------------------------------------------------------- #

def hex_to_bytes(h: str) -> bytes:
    return bytes.fromhex(h[2:] if h.startswith("0x") else h)


def bytes_to_hex(b: bytes) -> str:
    return "0x" + b.hex()


def root_from_hex_leaves(leaf_hexes: List[str]) -> str:
    return bytes_to_hex(merkle_root([hex_to_bytes(h) for h in leaf_hexes]))


def proof_from_hex_leaves(leaf_hexes: List[str], index: int) -> List[str]:
    return [bytes_to_hex(p) for p in merkle_proof([hex_to_bytes(h) for h in leaf_hexes], index)]


# --------------------------------------------------------------------------- #
#  Self-test (mirrors contracts/test/mlx3.test.ts)
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    # canonical -> leaf path (used by the audit page to recompute leaves)
    _c = canonical_action("sess-1", 0, "execute_step", "Run tests", {"exit_code": 0})
    assert leaf_hash_hex(_c) == bytes_to_hex(sha256_bytes(_c.encode("utf-8")))
    assert len(leaf_hash_hex(_c)) == 66  # 0x + 64 hex chars

    for n in (1, 2, 3, 5, 8, 9):
        leaves = [sha256_bytes(f"action-{i}".encode()) for i in range(n)]
        root = merkle_root(leaves)
        for i in range(n):
            proof = merkle_proof(leaves, i)
            assert verify_proof(leaves[i], proof, i, root), f"leaf {i} of {n} failed"
        # tampered leaf must fail
        bad = sha256_bytes(b"tampered")
        assert not verify_proof(bad, merkle_proof(leaves, 0), 0, root)
        print(f"  ok  {n}-leaf tree: all {n} proofs verify, tamper rejected  root={bytes_to_hex(root)[:18]}…")
    print("merkle self-test passed")
