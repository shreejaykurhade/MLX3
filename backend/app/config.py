"""Runtime configuration, loaded from environment / .env.

Nothing here is required to boot: with no ANTHROPIC_API_KEY the agent falls back to a
scripted mock brain, with no Supabase it uses an in-memory store, and with no
AGENT_PRIVATE_KEY / contract addresses the attestation is simulated. Configure them to
run the real thing against Monad testnet.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _truthy(v: str) -> bool:
    return v.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    def __init__(self) -> None:
        # --- Anthropic / agent ---
        self.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        # Default to the most capable model; override with ANTHROPIC_MODEL=claude-sonnet-4-6
        # for a faster/cheaper demo loop.
        self.anthropic_model = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8").strip()
        self.agent_max_tokens = int(os.getenv("AGENT_MAX_TOKENS", "8000"))
        self.agent_max_turns = int(os.getenv("AGENT_MAX_TURNS", "16"))
        self.confirm_timeout_seconds = int(os.getenv("CONFIRM_TIMEOUT_SECONDS", "900"))
        forced_mock = _truthy(os.getenv("USE_MOCK_AGENT", ""))
        self.use_mock_agent = forced_mock or not self.anthropic_api_key

        # --- Chain / Monad testnet ---
        self.monad_rpc_url = os.getenv("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz")
        self.chain_id = int(os.getenv("MONAD_CHAIN_ID", "10143"))
        self.explorer_url = os.getenv("EXPLORER_URL", "https://testnet.monadexplorer.com").rstrip("/")
        self.agent_private_key = os.getenv("AGENT_PRIVATE_KEY", "").strip()
        self.provider_registry_address = os.getenv("PROVIDER_REGISTRY_ADDRESS", "").strip()
        self.execution_attestation_address = os.getenv("EXECUTION_ATTESTATION_ADDRESS", "").strip()

        # --- Supabase (optional) ---
        self.supabase_url = os.getenv("SUPABASE_URL", "").strip()
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

        # --- HTTP ---
        self.cors_origins = [
            o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
        ]

        self._load_deployment_fallback()

    def _load_deployment_fallback(self) -> None:
        """If contract addresses weren't provided, read them from the Hardhat deployment
        artifact written by `npm run deploy:monad` in Step 1."""
        if self.provider_registry_address and self.execution_attestation_address:
            return
        candidate = Path(__file__).resolve().parents[2] / "contracts" / "deployments" / "monadTestnet.json"
        if not candidate.exists():
            return
        try:
            data = json.loads(candidate.read_text())
            contracts = data.get("contracts", {})
            self.provider_registry_address = self.provider_registry_address or contracts.get("ProviderRegistry", "")
            self.execution_attestation_address = (
                self.execution_attestation_address or contracts.get("ExecutionAttestation", "")
            )
        except Exception:
            pass

    # --- derived flags ---
    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_key)

    @property
    def chain_read_enabled(self) -> bool:
        return bool(self.monad_rpc_url and self.provider_registry_address)

    @property
    def chain_write_enabled(self) -> bool:
        return bool(self.monad_rpc_url and self.execution_attestation_address and self.agent_private_key)

    def summary(self) -> dict:
        return {
            "agent": "mock" if self.use_mock_agent else f"claude ({self.anthropic_model})",
            "store": "supabase" if self.supabase_enabled else "in-memory",
            "chain_read": self.chain_read_enabled,
            "chain_write": self.chain_write_enabled,
            "provider_registry": self.provider_registry_address or None,
            "execution_attestation": self.execution_attestation_address or None,
        }


settings = Settings()
