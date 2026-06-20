"""Monad testnet interaction via web3.py.

Reads active providers from ProviderRegistry and submits Merkle roots to
ExecutionAttestation. Degrades gracefully: if the chain isn't reachable or keys/addresses
aren't configured, provider reads return [] (a default provider is used upstream) and
attestation submission is *simulated* (a deterministic fake tx hash, clearly flagged).
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from .config import settings

# Minimal ABIs — only the functions MLX3 calls.
PROVIDER_REGISTRY_ABI = [
    {
        "inputs": [],
        "name": "getActiveProviders",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "owner", "type": "address"},
                    {"internalType": "string", "name": "metadata", "type": "string"},
                    {"internalType": "uint256", "name": "stake", "type": "uint256"},
                    {"internalType": "uint256", "name": "rate", "type": "uint256"},
                    {"internalType": "uint256", "name": "jobsCompleted", "type": "uint256"},
                    {"internalType": "bool", "name": "active", "type": "bool"},
                    {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
                ],
                "internalType": "struct ProviderRegistry.Provider[]",
                "name": "",
                "type": "tuple[]",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

EXECUTION_ATTESTATION_ABI = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "sessionId", "type": "bytes32"},
            {"internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
            {"internalType": "address", "name": "provider", "type": "address"},
            {"internalType": "uint256", "name": "leafCount", "type": "uint256"},
        ],
        "name": "submitAttestation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "sessionId", "type": "bytes32"}],
        "name": "isAttested",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def _parse_metadata(raw: str) -> Any:
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


class ChainClient:
    def __init__(self) -> None:
        self._w3 = None
        self._account = None
        self._registry = None
        self._attestation = None
        self._init_error: Optional[str] = None
        self._setup()

    def _setup(self) -> None:
        try:
            from web3 import Web3

            self._Web3 = Web3
            self._w3 = Web3(Web3.HTTPProvider(settings.monad_rpc_url, request_kwargs={"timeout": 20}))

            # POA-style chains include a long extraData field; inject middleware if available.
            try:
                from web3.middleware import geth_poa_middleware  # web3 v6

                self._w3.middleware_onion.inject(geth_poa_middleware, layer=0)
            except Exception:
                try:
                    from web3.middleware import ExtraDataToPOAMiddleware  # web3 v7

                    self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
                except Exception:
                    pass

            if settings.provider_registry_address:
                self._registry = self._w3.eth.contract(
                    address=Web3.to_checksum_address(settings.provider_registry_address),
                    abi=PROVIDER_REGISTRY_ABI,
                )
            if settings.execution_attestation_address:
                self._attestation = self._w3.eth.contract(
                    address=Web3.to_checksum_address(settings.execution_attestation_address),
                    abi=EXECUTION_ATTESTATION_ABI,
                )
            self._load_account()
        except Exception as e:
            self._init_error = str(e)

    def _load_account(self) -> None:
        """Load the agent signing account from AGENT_PRIVATE_KEY, tolerating a missing
        0x prefix and skipping unset/placeholder values without raising."""
        pk = settings.agent_private_key.strip()
        if not pk or pk.upper().endswith("YOUR_AGENT_PRIVATE_KEY"):
            return
        if not pk.startswith("0x"):
            pk = "0x" + pk
        body = pk[2:]
        if len(body) != 64 or any(c not in "0123456789abcdefABCDEF" for c in body):
            print("[chain] AGENT_PRIVATE_KEY is not a 32-byte hex key — on-chain submission stays simulated")
            return
        try:
            self._account = self._w3.eth.account.from_key(pk)
            print(f"[chain] agent wallet loaded: {self._account.address}")
        except Exception as e:  # pragma: no cover
            print(f"[chain] could not load AGENT_PRIVATE_KEY: {e}")

    # ----------------------------------------------------------------- #

    def session_id_to_bytes32(self, session_uuid: str) -> str:
        """Map a backend session UUID to the on-chain bytes32 id (keccak256 of the string)."""
        if self._w3 is not None:
            return self._w3.keccak(text=session_uuid).hex()
        # Fallback keccak via eth-hash so the id is stable even without a live RPC.
        from eth_utils import keccak

        return "0x" + keccak(text=session_uuid).hex()

    async def get_active_providers(self) -> List[Dict[str, Any]]:
        if not (settings.chain_read_enabled and self._registry is not None):
            return []
        import asyncio

        def _call():
            return self._registry.functions.getActiveProviders().call()

        try:
            rows = await asyncio.to_thread(_call)
        except Exception as e:
            print(f"[chain] getActiveProviders failed: {e}")
            return []

        providers = []
        for r in rows:
            providers.append(
                {
                    "address": r[0],
                    "metadata": _parse_metadata(r[1]),
                    "stake": str(r[2]),
                    "rate": str(r[3]),
                    "jobs_completed": int(r[4]),
                    "active": bool(r[5]),
                    "registered_at": int(r[6]),
                }
            )
        return providers

    async def get_balance(self, address: Optional[str]) -> Optional[int]:
        """Native MON balance (wei) of an address, or None if unavailable."""
        if not address or self._w3 is None:
            return None
        import asyncio

        def _call():
            checksum = self._Web3.to_checksum_address(address)
            return int(self._w3.eth.get_balance(checksum))

        try:
            return await asyncio.to_thread(_call)
        except Exception:
            return None

    async def submit_attestation(
        self, session_id_bytes32: str, merkle_root_hex: str, provider_address: Optional[str], leaf_count: int
    ) -> Dict[str, Any]:
        """Submit the root on-chain, or simulate when not configured."""
        if not (settings.chain_write_enabled and self._attestation is not None and self._account is not None):
            return self._simulate(session_id_bytes32, merkle_root_hex)

        import asyncio

        def _send():
            Web3 = self._Web3
            provider = (
                Web3.to_checksum_address(provider_address)
                if provider_address and int(provider_address, 16) != 0
                else "0x0000000000000000000000000000000000000000"
            )
            fn = self._attestation.functions.submitAttestation(
                Web3.to_bytes(hexstr=session_id_bytes32),
                Web3.to_bytes(hexstr=merkle_root_hex),
                provider,
                int(leaf_count),
            )
            tx = fn.build_transaction(
                {
                    "from": self._account.address,
                    "nonce": self._w3.eth.get_transaction_count(self._account.address),
                    "chainId": settings.chain_id,
                    "gasPrice": self._w3.eth.gas_price,
                }
            )
            signed = self._account.sign_transaction(tx)
            raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
            tx_hash = self._w3.eth.send_raw_transaction(raw)
            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
            return {
                "tx_hash": tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash),
                "block_number": receipt.get("blockNumber"),
                "status": int(receipt.get("status", 1)),
            }

        try:
            result = await asyncio.to_thread(_send)
            return {"simulated": False, **result}
        except Exception as e:
            print(f"[chain] submitAttestation failed, falling back to simulation: {e}")
            sim = self._simulate(session_id_bytes32, merkle_root_hex)
            sim["error"] = str(e)
            return sim

    def _simulate(self, session_id_bytes32: str, merkle_root_hex: str) -> Dict[str, Any]:
        from eth_utils import keccak

        fake = keccak(text=session_id_bytes32 + merkle_root_hex)
        return {"simulated": True, "tx_hash": "0x" + fake.hex(), "block_number": None, "status": 1}

    def status(self) -> Dict[str, Any]:
        connected = False
        block = None
        if self._w3 is not None:
            try:
                connected = self._w3.is_connected()
                if connected:
                    block = self._w3.eth.block_number
            except Exception:
                connected = False
        return {
            "connected": connected,
            "block_number": block,
            "read_enabled": settings.chain_read_enabled,
            "write_enabled": settings.chain_write_enabled,
            "agent_address": self._account.address if self._account else None,
            "init_error": self._init_error,
        }
