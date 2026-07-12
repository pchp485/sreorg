"""End-to-end security tests for the secure voice pipeline.

These are the most important tests in the system: they prove the core promise —
only Harish and his spouse can execute commands; children, guests, and unknown
speakers are correctly constrained.
"""

from __future__ import annotations

import pytest

from app.domain.permissions import UNAUTHORIZED_SPEAKER_RESPONSE
from app.providers.textmode import encode


async def _run(pipeline, text: str, *, speaker=None, confidence=0.99, session="s"):
    audio = encode(text, speaker=speaker, confidence=confidence)
    return await pipeline.process(audio, session_id=session)


@pytest.mark.asyncio
async def test_no_wake_word_is_ignored(pipeline) -> None:
    result = await _run(pipeline, "turn off the downstairs lights", speaker="harish")
    assert result.denial_reason == "no_wake_word"
    assert result.spoken_response == ""
    assert not result.executed


@pytest.mark.asyncio
async def test_unknown_speaker_rejected(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI turn off the lights", speaker="stranger"
    )
    assert not result.authorized
    assert result.denial_reason == "unauthorized_speaker"
    assert result.spoken_response == UNAUTHORIZED_SPEAKER_RESPONSE
    assert not result.executed


@pytest.mark.asyncio
async def test_low_confidence_rejected(pipeline) -> None:
    # Correct speaker but below the confidence threshold -> rejected.
    result = await _run(
        pipeline, "Hey ParentAI unlock the front door", speaker="harish",
        confidence=0.4,
    )
    assert result.denial_reason == "unauthorized_speaker"
    assert not result.executed


@pytest.mark.asyncio
async def test_parent_can_control_home(pipeline, container) -> None:
    result = await _run(
        pipeline, "Hey ParentAI turn off the downstairs lights", speaker="harish"
    )
    assert result.authorized and result.executed
    assert "downstairs lights" in result.spoken_response.lower()
    assert result.user.id == "harish"


@pytest.mark.asyncio
async def test_spouse_can_control_home(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI lock the front door", speaker="spouse"
    )
    assert result.executed
    assert "locked" in result.spoken_response.lower()


@pytest.mark.asyncio
async def test_parent_set_temperature(pipeline) -> None:
    result = await _run(pipeline, "Hey ParentAI set the AC to 72", speaker="harish")
    assert result.executed
    assert result.intent.action == "set_temperature"
    assert result.intent.parameters["temperature"] == 72


@pytest.mark.asyncio
async def test_child_denied_home_automation(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI turn off the lights", speaker="child_leo"
    )
    assert result.authorized  # child is a verified speaker
    assert not result.executed
    assert result.denial_reason == "child_mode_block"
    assert result.intent.category.value == "home_automation"


@pytest.mark.asyncio
async def test_child_denied_purchase(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI buy me a new video game", speaker="child_leo"
    )
    assert not result.executed
    assert result.denial_reason == "child_mode_block"


@pytest.mark.asyncio
async def test_child_denied_security_action(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI unlock the front door", speaker="child_leo"
    )
    assert not result.executed
    assert result.denial_reason == "child_mode_block"


@pytest.mark.asyncio
async def test_child_can_ask_educational_question(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI why is the sky blue?", speaker="child_leo"
    )
    assert result.executed
    assert result.intent.category.value == "educational_query"


@pytest.mark.asyncio
async def test_guest_denied_home_automation(pipeline) -> None:
    result = await _run(
        pipeline, "Hey ParentAI open the garage", speaker="guest"
    )
    assert not result.executed
    assert result.denial_reason and "not_permitted" in result.denial_reason


@pytest.mark.asyncio
async def test_wake_word_hey_jarvis(pipeline) -> None:
    result = await _run(
        pipeline, "Hey Jarvis turn on the kitchen lights", speaker="harish"
    )
    assert result.executed


@pytest.mark.asyncio
async def test_disabled_user_rejected(pipeline, container) -> None:
    container.auth.set_enabled("harish", False)
    result = await _run(
        pipeline, "Hey ParentAI turn off the lights", speaker="harish"
    )
    assert result.denial_reason == "unauthorized_speaker"


@pytest.mark.asyncio
async def test_device_state_actually_changes(pipeline, container) -> None:
    await _run(
        pipeline, "Hey ParentAI turn off the downstairs lights", speaker="harish"
    )
    # The mock device provider is the catch-all; verify state mutated.
    mock = container.devices._providers[-1]
    assert mock.state["downstairs_lights"]["on"] is False
