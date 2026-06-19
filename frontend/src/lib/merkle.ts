/**
 * SHA-256 binary Merkle verification — must match backend/app/merkle.py and the
 * Solidity ExecutionAttestation.processProof exactly.
 *
 *   leaf        = SHA-256(canonical_json(action))   (recomputed from the stored canonical)
 *   parent(a,b) = SHA-256(a || b)
 *   odd level   : last node duplicated
 *   index       : leaf position, decides left/right at each level
 */
import { sha256 } from "@noble/hashes/sha256";

function strip0x(h: string): string {
  return h.startsWith("0x") ? h.slice(2) : h;
}

function hexToBytes(h: string): Uint8Array {
  const s = strip0x(h);
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(b: Uint8Array): string {
  let s = "0x";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

function pair(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return sha256(combined);
}

/** SHA-256 of the canonical action string -> 0x leaf hash. */
export function leafHashHex(canonical: string): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

/** Reconstruct the root from leaf + proof using position-aware SHA-256. */
export function processProof(leafHex: string, proofHexes: string[], index: number): string {
  let computed = hexToBytes(leafHex);
  let idx = index;
  for (const sib of proofHexes) {
    const sibling = hexToBytes(sib);
    computed = idx % 2 === 0 ? pair(computed, sibling) : pair(sibling, computed);
    idx = Math.floor(idx / 2);
  }
  return bytesToHex(computed);
}

export function verifyProof(leafHex: string, proofHexes: string[], index: number, rootHex: string): boolean {
  const computed = processProof(leafHex, proofHexes, index).toLowerCase();
  const expected = (rootHex.startsWith("0x") ? rootHex : "0x" + rootHex).toLowerCase();
  return computed === expected;
}

/** Compute the Merkle root from an ordered list of leaf hashes. */
export function computeRoot(leafHexes: string[]): string | null {
  if (leafHexes.length === 0) return null;
  let level = leafHexes.map(hexToBytes);
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(pair(left, right));
    }
    level = next;
  }
  return bytesToHex(level[0]);
}
