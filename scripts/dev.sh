#!/usr/bin/env bash
# Bootstrap and run the ParentAI backend locally with mock/local providers.
set -euo pipefail
cd "$(dirname "$0")/../backend"

if [ ! -d .venv ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r requirements.txt

export PARENTAI_ENVIRONMENT=local
echo "Starting ParentAI on http://localhost:8000 (docs at /docs)"
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
