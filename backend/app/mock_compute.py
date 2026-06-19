"""Realistic-but-fake compute execution.

The platform is about *verifying* what an agent did, not the compute itself, so each step
is mocked. Output is deterministic (seeded by the command) so a re-run of the same session
reproduces the same logs — and it reads like a real job ran on a remote provider.
"""
from __future__ import annotations

import hashlib
import random
from typing import Any, Dict, List


def _seed(command: str) -> random.Random:
    h = int(hashlib.sha256(command.encode()).hexdigest(), 16)
    return random.Random(h)


# (keyword, [stdout line templates]) — first matching keyword wins.
_TEMPLATES: List[tuple[tuple[str, ...], List[str]]] = [
    (("clone", "checkout", "git"), [
        "Cloning into 'workspace'...",
        "remote: Enumerating objects: {n1}, done.",
        "remote: Counting objects: 100% ({n1}/{n1}), done.",
        "Receiving objects: 100% ({n1}/{n1}), {mb} MiB | {mb2} MiB/s, done.",
        "Resolved {n2} deltas, checked out HEAD at {sha}",
    ]),
    (("install", "dependencies", "pip", "npm", "deps"), [
        "Resolving dependency graph...",
        "Downloaded {n1} packages ({mb} MiB)",
        "Installed {n1} packages in {sec}s",
        "audited {n2} packages — 0 vulnerabilities",
    ]),
    (("build", "compile", "bundle"), [
        "Compiling {n1} modules...",
        "  ✓ type-check passed ({n2} files)",
        "  ✓ bundling complete ({mb} MiB)",
        "Build finished in {sec}s — artifact sha256:{sha}",
    ]),
    (("test", "pytest", "jest", "spec"), [
        "Collected {n1} tests",
        "{n1} passed, 0 failed, {n3} skipped in {sec}s",
        "coverage: {cov}% of statements",
    ]),
    (("train", "model", "fit", "epoch", "ml"), [
        "Loading dataset ({n1} samples, {n2} features)...",
        "epoch 1/3  loss={loss1}  acc={acc1}",
        "epoch 2/3  loss={loss2}  acc={acc2}",
        "epoch 3/3  loss={loss3}  acc={acc3}",
        "Saved checkpoint model.safetensors ({mb} MiB)",
    ]),
    (("scrape", "fetch", "crawl", "download", "http", "api"), [
        "Fetching {n1} URLs (concurrency=8)...",
        "  {n1} ok, 0 errors, {n3} cached",
        "Extracted {n2} records ({mb} MiB) in {sec}s",
    ]),
    (("analyze", "process", "transform", "aggregate", "query", "data"), [
        "Reading input ({n1} rows)...",
        "Applying {n3} transforms...",
        "Wrote {n2} rows to output ({mb} MiB) in {sec}s",
    ]),
]

_DEFAULT = [
    "Starting task on provider node...",
    "  step running ({n1} ops)",
    "Completed {n2} operations in {sec}s",
]


def run_step(title: str, command: str) -> Dict[str, Any]:
    """Execute one mocked step. Returns realistic stdout + metrics."""
    rng = _seed(command + "|" + title)
    text = (title + " " + command).lower()

    lines = _DEFAULT
    for keywords, template in _TEMPLATES:
        if any(k in text for k in keywords):
            lines = template
            break

    fmt = {
        "n1": rng.randint(40, 1800),
        "n2": rng.randint(10, 600),
        "n3": rng.randint(0, 12),
        "mb": round(rng.uniform(0.4, 84.0), 1),
        "mb2": round(rng.uniform(2.0, 40.0), 1),
        "sec": round(rng.uniform(0.3, 9.5), 2),
        "sha": hashlib.sha256(command.encode()).hexdigest()[:12],
        "cov": rng.randint(71, 99),
        "loss1": round(rng.uniform(0.6, 1.2), 3),
        "loss2": round(rng.uniform(0.3, 0.6), 3),
        "loss3": round(rng.uniform(0.08, 0.3), 3),
        "acc1": round(rng.uniform(0.55, 0.75), 3),
        "acc2": round(rng.uniform(0.75, 0.88), 3),
        "acc3": round(rng.uniform(0.88, 0.98), 3),
    }
    stdout = "\n".join(line.format(**fmt) for line in lines)
    duration_ms = int(rng.uniform(350, 9500))
    exit_code = 0  # mocked steps always succeed for a clean demo

    return {
        "command": command,
        "stdout": stdout,
        "exit_code": exit_code,
        "duration_ms": duration_ms,
        "resources": {
            "cpu_pct": round(rng.uniform(12, 96), 1),
            "mem_mb": rng.randint(128, 4096),
            "node": f"node-{rng.randint(1, 32):02d}.monad-compute.xyz",
        },
    }
