"""Deterministic rule-based intent extraction.

Shared by the mock LLM (offline default) and used as a fast-path/fallback by
the OpenAI provider. It maps natural-language commands to a structured
:class:`Intent`. Keeping this rule engine separate makes it independently
testable and lets the system classify commands with zero cloud dependency.
"""

from __future__ import annotations

import re

from app.domain.models import ActionCategory, Intent

_NUMBER = re.compile(r"(\d+)")

# Ordered rules: (regex, category, action, target-extractor)
_RULES: list[tuple[re.Pattern[str], ActionCategory, str]] = [
    (re.compile(r"\block\b.*\bunlock|unlock\b"), ActionCategory.SECURITY_ACTION, "unlock"),
    (re.compile(r"\block\b"), ActionCategory.SECURITY_ACTION, "lock"),
    (re.compile(r"\bopen\b.*\bgarage|garage.*\bopen"), ActionCategory.SECURITY_ACTION, "open"),
    (re.compile(r"\bclose\b.*\bgarage|garage.*\bclose"), ActionCategory.SECURITY_ACTION, "close"),
    (re.compile(r"\barm\b|\bdisarm\b|\balarm\b"), ActionCategory.SECURITY_ACTION, "arm"),
    (re.compile(r"\bbuy\b|\border\b|\bpurchase\b|\badd .*to .*cart"), ActionCategory.PURCHASE, "purchase"),
    (re.compile(r"\bturn off\b|\bswitch off\b"), ActionCategory.HOME_AUTOMATION, "turn_off"),
    (re.compile(r"\bturn on\b|\bswitch on\b"), ActionCategory.HOME_AUTOMATION, "turn_on"),
    (re.compile(r"\bset\b.*\b(ac|a/c|thermostat|temperature|heat|cooling)\b"), ActionCategory.HOME_AUTOMATION, "set_temperature"),
    (re.compile(r"\bdim\b|\bbrightness\b"), ActionCategory.HOME_AUTOMATION, "set_brightness"),
    (re.compile(r"\bwhy\b|\bwhat is\b|\bhow do|\bexplain\b|\bteach\b|\bhelp me with my homework\b"), ActionCategory.EDUCATIONAL_QUERY, "answer"),
]


def _extract_target(text: str) -> str | None:
    # Common named targets in a smart home.
    for target in (
        "downstairs lights",
        "upstairs lights",
        "living room lights",
        "bedroom lights",
        "kitchen lights",
        "front door",
        "back door",
        "garage",
        "ac",
        "thermostat",
        "lights",
    ):
        if target in text:
            return target.replace(" ", "_")
    return None


def extract_intent(utterance: str) -> Intent:
    text = utterance.lower().strip()
    for pattern, category, action in _RULES:
        if pattern.search(text):
            params: dict[str, object] = {}
            if action == "set_temperature":
                m = _NUMBER.search(text)
                if m:
                    params["temperature"] = int(m.group(1))
            if action == "set_brightness":
                m = _NUMBER.search(text)
                if m:
                    params["brightness"] = int(m.group(1))
            return Intent(
                category=category,
                action=action,
                target=_extract_target(text),
                parameters=params,
                utterance=utterance,
                confidence=0.9,
            )
    # Default: a general question for the LLM to answer conversationally.
    return Intent(
        category=ActionCategory.GENERAL_QUERY,
        action="answer",
        target=None,
        utterance=utterance,
        confidence=0.5,
    )
