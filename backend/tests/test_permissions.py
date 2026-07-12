"""Unit tests for the pure permission policy — the security rule matrix."""

from __future__ import annotations

import pytest

from app.domain.models import ActionCategory, Role
from app.domain.permissions import (
    UNAUTHORIZED_SPEAKER_RESPONSE,
    PermissionPolicy,
)

policy = PermissionPolicy()


@pytest.mark.parametrize("category", list(ActionCategory))
def test_parent_can_do_everything_except_admin(category: ActionCategory) -> None:
    allowed = policy.is_allowed(Role.PARENT, category)
    if category is ActionCategory.SYSTEM_ADMIN:
        assert not allowed
    else:
        assert allowed


@pytest.mark.parametrize("category", list(ActionCategory))
def test_admin_can_do_everything(category: ActionCategory) -> None:
    assert policy.is_allowed(Role.ADMIN, category)


def test_unknown_speaker_denied_everything() -> None:
    for category in ActionCategory:
        assert not policy.is_allowed(Role.UNKNOWN, category)
    decision = policy.evaluate(Role.UNKNOWN, ActionCategory.HOME_AUTOMATION)
    assert decision.spoken_response == UNAUTHORIZED_SPEAKER_RESPONSE


def test_child_denied_protected_actions() -> None:
    for category in (
        ActionCategory.HOME_AUTOMATION,
        ActionCategory.SECURITY_ACTION,
        ActionCategory.PURCHASE,
    ):
        decision = policy.evaluate(Role.CHILD, category)
        assert not decision.allowed
        assert decision.reason == "child_mode_block"
        assert decision.spoken_response  # a child-friendly refusal is present


def test_child_allowed_educational_and_general() -> None:
    assert policy.is_allowed(Role.CHILD, ActionCategory.EDUCATIONAL_QUERY)
    assert policy.is_allowed(Role.CHILD, ActionCategory.GENERAL_QUERY)


def test_guest_only_general_query() -> None:
    assert policy.is_allowed(Role.GUEST, ActionCategory.GENERAL_QUERY)
    assert not policy.is_allowed(Role.GUEST, ActionCategory.HOME_AUTOMATION)
    assert not policy.is_allowed(Role.GUEST, ActionCategory.EDUCATIONAL_QUERY)


def test_policy_is_deny_by_default() -> None:
    empty = PermissionPolicy(overrides={Role.GUEST: frozenset()})
    assert not empty.is_allowed(Role.GUEST, ActionCategory.GENERAL_QUERY)
