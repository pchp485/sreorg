"""Minimal Python client for the ParentAI API.

Usage:
    python examples/client.py "Hey ParentAI, turn off the lights" --speaker harish
"""

from __future__ import annotations

import argparse
import json
import urllib.request


def command(base: str, text: str, speaker: str | None, confidence: float) -> dict:
    payload = json.dumps(
        {"text": text, "speaker": speaker, "confidence": confidence}
    ).encode()
    req = urllib.request.Request(
        f"{base}/api/voice/command",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main() -> None:
    parser = argparse.ArgumentParser(description="ParentAI command client")
    parser.add_argument("text", help="The spoken command (include the wake word)")
    parser.add_argument("--speaker", default="harish")
    parser.add_argument("--confidence", type=float, default=0.99)
    parser.add_argument("--base", default="http://localhost:8000")
    args = parser.parse_args()

    result = command(args.base, args.text, args.speaker, args.confidence)
    print(json.dumps(result, indent=2))
    if result["executed"]:
        print(f"\n✅ {result['spoken_response']}")
    else:
        print(f"\n🚫 {result['spoken_response'] or '(ignored — no wake word)'}")


if __name__ == "__main__":
    main()
