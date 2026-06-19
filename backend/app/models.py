"""Pydantic request models. Responses are plain dicts for flexibility."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    wallet_address: str = Field(..., description="The connected user's wallet address")
    task_prompt: str = Field(..., min_length=1, description="Natural-language task or instructions")
    task_type: Literal["prompt", "github"] = "prompt"
    github_url: Optional[str] = None


class ConfirmRequest(BaseModel):
    confirmed: bool = Field(..., description="True to execute the plan, False to reject it")


class AuthVerifyRequest(BaseModel):
    """Simplified SIWE verification payload."""
    address: str
    message: str
    signature: str
