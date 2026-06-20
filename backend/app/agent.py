"""The agent runner: a two-phase lifecycle (plan -> confirm -> execute) driven either by
Claude (structured tool use) or a scripted mock brain. Both share tools.execute_tool.

Phase 1 (planning): tools = analyze_task, make_plan. Ends when make_plan is called.
                     -> status awaiting_confirmation, plan streamed for the user.
Phase 2 (execution): tools = execute_step, hash_action, build_merkle_root,
                     submit_attestation. Runs after the user confirms.

A safety net (`finalize`) guarantees the tree is built and the attestation submitted even
if the LLM under-calls the closing tools, so the demo always completes.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional

from . import tools
from .chain import ChainClient
from .config import settings
from .store import BaseStore
from .tools import AgentContext, execute_tool
from .ws import WSManager

SYSTEM_PLANNING = """You are the MLX3 planning agent. MLX3 is a decentralized platform for \
verifiable agent execution on the Monad blockchain: every action you take is SHA-256 hashed \
into a Merkle tree whose root is committed on-chain, so anyone can later verify exactly what \
you did.

Your job in THIS phase is only to plan:
1. Call analyze_task once with your understanding of the task. Its result lists the available \
on-chain compute providers.
2. Call make_plan once: pick the best provider (by address) from that list and lay out a \
concrete, ordered list of 3-6 execution steps. Each step needs a real-looking command.

Do not execute anything. After make_plan, stop — the user must confirm the plan first.
Keep any text brief."""

SYSTEM_EXECUTION = """You are the MLX3 execution agent. The user has confirmed the plan. \
Every action is SHA-256 hashed into a Merkle tree committed on-chain, so be methodical.

Execute the plan in order:
1. For each planned step: call execute_step, then call hash_action to commit it to the \
verifiable Merkle log.
2. When every step is executed and hashed, call build_merkle_root once.
3. Finally call submit_attestation once to commit the root to Monad.

Keep any text brief. Finish after submit_attestation."""


class AgentError(Exception):
    pass


class AgentRunner:
    def __init__(self, session: Dict[str, Any], store: BaseStore, chain: ChainClient, ws: WSManager) -> None:
        self.ctx = AgentContext(session, store, chain, ws)
        self.session_id = session["id"]
        self._confirm: "asyncio.Future[bool]" = asyncio.get_event_loop().create_future()
        self._client = None
        if not settings.use_mock_agent:
            from anthropic import AsyncAnthropic

            self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    # ----------------------------------------------------------------- #
    #  Public lifecycle
    # ----------------------------------------------------------------- #

    def confirm(self, confirmed: bool) -> None:
        if not self._confirm.done():
            self._confirm.set_result(confirmed)

    async def run(self) -> None:
        try:
            await self.ctx.set_status("planning")
            await self._plan_phase()
            if not self.ctx.plan:
                await self._fallback_plan()

            await self.ctx.set_status("awaiting_confirmation")
            await self.ctx.ws.broadcast(
                self.session_id,
                "plan_ready",
                {"plan": self.ctx.plan, "provider": self.ctx.plan.get("provider") if self.ctx.plan else None},
            )

            confirmed = await self._wait_confirm()
            if not confirmed:
                await self.ctx.set_status("rejected")
                return

            await self.ctx.set_status("executing")
            await self._exec_phase()
            await self._finalize()
        except Exception as e:  # noqa: BLE001 — surface any failure to the UI
            fields = {"status": "failed", "error": str(e)}
            if self.ctx.session.get("task_type") == "github":
                fields["deployment_status"] = "failed"
            await self.ctx.store.update_session(self.session_id, **fields)
            await self.ctx.ws.broadcast(self.session_id, "error", {"message": str(e)})

    async def _wait_confirm(self) -> bool:
        try:
            return await asyncio.wait_for(self._confirm, timeout=settings.confirm_timeout_seconds)
        except asyncio.TimeoutError:
            return False

    # ----------------------------------------------------------------- #
    #  Planning / execution phases
    # ----------------------------------------------------------------- #

    async def _plan_phase(self) -> None:
        if self._client is None:
            await self._mock_plan()
            return
        first = self._planning_prompt()
        await self._run_claude(
            system=SYSTEM_PLANNING,
            tool_defs=tools.PLANNING_TOOLS,
            first_user=first,
            stop_when=lambda: self.ctx.plan is not None,
        )

    async def _exec_phase(self) -> None:
        if self.ctx.session.get("task_type") == "github" and self.ctx.session.get("github_url"):
            await self._deploy_github()
            return
        if self._client is None:
            await self._mock_exec()
            return
        first = self._execution_prompt()
        await self._run_claude(
            system=SYSTEM_EXECUTION,
            tool_defs=tools.EXECUTION_TOOLS,
            first_user=first,
            stop_when=lambda: self.ctx.attestation is not None,
        )

    async def _deploy_github(self) -> None:
        from .deployer import deploy_repository

        await self.ctx.store.update_session(self.session_id, deployment_status="building")
        await self.ctx.ws.broadcast(self.session_id, "deployment", {"status": "building"})
        result = await deploy_repository(
            self.ctx.session["github_url"], self.session_id, self.ctx.emit_log
        )
        deployment = {
            "deployment_status": "running",
            "deployment_slug": result.slug,
            "deployment_url": result.url,
            "deployment_container_id": result.container_id,
            "deployment_image": result.image,
            "deployment_port": result.container_port,
        }
        self.ctx.session.update(deployment)
        await self.ctx.store.update_session(self.session_id, **deployment)
        await self.ctx.log_action(
            "execute_step",
            "Deployed public GitHub repository",
            {
                "repository": self.ctx.session["github_url"],
                "deployment_url": result.url,
                "container_id": result.container_id,
                "image": result.image,
                "container_port": result.container_port,
                "exit_code": 0,
            },
        )
        await self.ctx.ws.broadcast(
            self.session_id,
            "deployment",
            {"status": "running", "url": result.url, "slug": result.slug},
        )

    def _planning_prompt(self) -> str:
        s = self.ctx.session
        if s.get("task_type") == "github" and s.get("github_url"):
            return (
                f"Task type: GitHub repository.\nRepository: {s['github_url']}\n"
                f"Instructions: {s['task_prompt']}\n\nAnalyze, then plan how to process this repo."
            )
        return f"Task: {s['task_prompt']}\n\nAnalyze the task, then produce an execution plan."

    def _execution_prompt(self) -> str:
        steps = self.ctx.plan.get("steps", []) if self.ctx.plan else []
        provider = self.ctx.selected_provider or {}
        lines = [f"{i}. {st.get('title')} — `{st.get('command')}`" for i, st in enumerate(steps)]
        return (
            "The user CONFIRMED this plan. Execute it now.\n"
            f"Provider: {provider.get('address')}\n"
            "Steps:\n" + "\n".join(lines) +
            "\n\nExecute each step (execute_step + hash_action), then build_merkle_root, then submit_attestation."
        )

    async def _run_claude(self, system: str, tool_defs: List[dict], first_user: str, stop_when) -> None:
        messages: List[Dict[str, Any]] = [{"role": "user", "content": first_user}]
        for _ in range(settings.agent_max_turns):
            resp = await self._client.messages.create(
                model=settings.anthropic_model,
                max_tokens=settings.agent_max_tokens,
                system=system,
                tools=tool_defs,
                messages=messages,
            )

            for block in resp.content:
                if getattr(block, "type", None) == "text" and block.text.strip():
                    await self.ctx.emit_log(block.text.strip())

            messages.append({"role": "assistant", "content": resp.content})

            if resp.stop_reason == "tool_use":
                tool_results = []
                for block in resp.content:
                    if getattr(block, "type", None) == "tool_use":
                        result = await execute_tool(self.ctx, block.name, dict(block.input))
                        tool_results.append(
                            {"type": "tool_result", "tool_use_id": block.id, "content": json.dumps(result)}
                        )
                messages.append({"role": "user", "content": tool_results})
                if stop_when():
                    return
            elif resp.stop_reason == "refusal":
                raise AgentError("The model declined this request.")
            else:
                return  # end_turn / stop

    # ----------------------------------------------------------------- #
    #  Scripted mock brain (used when no ANTHROPIC_API_KEY is configured)
    # ----------------------------------------------------------------- #

    async def _mock_plan(self) -> None:
        await self.ctx.emit_log("Analyzing task and reading on-chain providers…")
        await execute_tool(
            self.ctx,
            "analyze_task",
            {
                "understanding": f"Process the task: {self.ctx.session['task_prompt'][:160]}",
                "category": self._guess_category(),
                "complexity": "medium",
                "estimated_steps": 4,
            },
        )
        provider = self.ctx.providers[0]
        steps = self._mock_steps()
        await self.ctx.emit_log(f"Selected provider {provider['address']}; drafted {len(steps)} steps.")
        await execute_tool(
            self.ctx,
            "make_plan",
            {
                "provider_address": provider["address"],
                "summary": f"Run {len(steps)} steps to complete: {self.ctx.session['task_prompt'][:80]}",
                "steps": steps,
            },
        )

    async def _mock_exec(self) -> None:
        steps = self.ctx.plan.get("steps", []) if self.ctx.plan else []
        for i, step in enumerate(steps):
            await execute_tool(
                self.ctx,
                "execute_step",
                {"step_index": i, "title": step.get("title", f"Step {i}"), "command": step.get("command", "")},
            )
            await execute_tool(self.ctx, "hash_action", {"note": f"commit step {i}"})
        await execute_tool(self.ctx, "build_merkle_root", {})
        await execute_tool(self.ctx, "submit_attestation", {})

    def _guess_category(self) -> str:
        t = (self.ctx.session.get("task_prompt", "") + " " + (self.ctx.session.get("github_url") or "")).lower()
        if self.ctx.session.get("task_type") == "github" or "github.com" in t or "repo" in t:
            return "code-build"
        for kw, cat in (
            ("train", "ml-training"), ("model", "ml-training"),
            ("scrape", "web-scrape"), ("crawl", "web-scrape"),
            ("analy", "data-analysis"), ("data", "data-analysis"),
        ):
            if kw in t:
                return cat
        return "general"

    def _mock_steps(self) -> List[Dict[str, str]]:
        s = self.ctx.session
        if s.get("task_type") == "github" and s.get("github_url"):
            repo = s["github_url"]
            return [
                {"title": "Clone repository", "command": f"git clone {repo} workspace", "expected_output": "checked out HEAD"},
                {"title": "Install dependencies", "command": "cd workspace && install dependencies", "expected_output": "packages installed"},
                {"title": "Run build", "command": "cd workspace && build project", "expected_output": "build artifact produced"},
                {"title": "Run test suite", "command": "cd workspace && run tests", "expected_output": "all tests passed"},
            ]
        prompt = s.get("task_prompt", "the task")
        return [
            {"title": "Provision environment", "command": "provision compute node and install deps", "expected_output": "environment ready"},
            {"title": "Fetch inputs", "command": f"fetch inputs for: {prompt[:60]}", "expected_output": "inputs fetched"},
            {"title": "Process task", "command": f"analyze and process: {prompt[:60]}", "expected_output": "processing complete"},
            {"title": "Write results", "command": "write results to output store", "expected_output": "results written"},
        ]

    async def _fallback_plan(self) -> None:
        """If the LLM finished planning without a plan, synthesize one so the flow continues."""
        await self.ctx.emit_log("Planning fell through; generating a default plan.")
        await self._mock_plan()

    async def _finalize(self) -> None:
        """Guarantee a complete, attested tree even if the agent under-called closing tools."""
        await self.ctx.commit_pending()
        if not self.ctx.merkle_root:
            await self.ctx.build_root()
        if self.ctx.attestation is None:
            await self.ctx.submit()
