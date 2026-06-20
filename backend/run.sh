#!/usr/bin/env bash
# Launch the MLX3 backend. Creates a venv on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt
fi

[ -f .env ] || cp .env.example .env

exec ./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
