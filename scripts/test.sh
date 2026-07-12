#!/usr/bin/env bash
# Run the backend test suite (and lint if ruff is installed).
set -euo pipefail
cd "$(dirname "$0")/../backend"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install -q -e ".[dev]"
else
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

command -v ruff >/dev/null 2>&1 && ruff check app tests || true
pytest -q
