#!/usr/bin/env bash
# Demonstrates the ParentAI security gate against a running backend.
# Usage: BASE=http://localhost:8000 ./examples/demo.sh
set -euo pipefail
BASE="${BASE:-http://localhost:8000}"

say() { printf "\n\033[1;35m» %s\033[0m\n" "$1"; }
cmd() {
  curl -s "$BASE/api/voice/command" -H 'content-type: application/json' -d "$1" \
    | python3 -m json.tool
}

say "Parent (Harish) turns off the lights → executed"
cmd '{"text":"Hey ParentAI, turn off the downstairs lights","speaker":"harish"}'

say "Parent sets the AC to 72 → executed"
cmd '{"text":"Hey ParentAI, set the AC to 72","speaker":"harish"}'

say "Unknown speaker → rejected"
cmd '{"text":"Hey ParentAI, unlock the front door","speaker":"stranger"}'

say "Correct parent but LOW confidence → rejected"
cmd '{"text":"Hey ParentAI, unlock the front door","speaker":"harish","confidence":0.4}'

say "Child asks to open the garage → child-mode block"
cmd '{"text":"Hey ParentAI, open the garage","speaker":"child_leo"}'

say "Child asks an educational question → allowed"
cmd '{"text":"Hey Jarvis, why is the sky blue?","speaker":"child_leo"}'

say "Guest tries home automation → not permitted"
cmd '{"text":"Hey ParentAI, turn on the kitchen lights","speaker":"guest"}'

say "No wake word → ignored"
cmd '{"text":"turn off the lights","speaker":"harish"}'
