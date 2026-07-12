"""Role-based permission policy.

This module is the single source of truth for *what each role may do*. It is
deliberately pure (no I/O) so the security rules can be exhaustively unit
tested. The policy is data-driven so it can later be loaded from the database
and edited from the dashboard without changing code.

Security model
--------------
* An **unknown / unverified** speaker can do *nothing*. The pipeline rejects
  before ever reaching this engine, but the policy encodes it too as
  defence in depth.
* **Parents** (Harish and spouse) and **admins** may do everything.
* **Guests** may only ask general questions.
* **Children** may only ask educational/general questions and are explicitly
  denied home automation, purchases and security actions ("child mode").
"""

from __future__ import annotations

from dataclasses import dataclass

from .models import ActionCategory, Role

# Default policy matrix: role -> set of permitted action categories.
# This is a *deny-by-default* model: anything not listed is denied.
_DEFAULT_POLICY: dict[Role, frozenset[ActionCategory]] = {
    Role.ADMIN: frozenset(ActionCategory),  # everything
    Role.PARENT: frozenset(
        {
            ActionCategory.HOME_AUTOMATION,
            ActionCategory.SECURITY_ACTION,
            ActionCategory.PURCHASE,
            ActionCategory.EDUCATIONAL_QUERY,
            ActionCategory.GENERAL_QUERY,
        }
    ),
    Role.GUEST: frozenset({ActionCategory.GENERAL_QUERY}),
    Role.CHILD: frozenset(
        {ActionCategory.EDUCATIONAL_QUERY, ActionCategory.GENERAL_QUERY}
    ),
    Role.UNKNOWN: frozenset(),  # deny everything
}

# Spoken responses for denials. Kept here so wording is centrally auditable.
UNAUTHORIZED_SPEAKER_RESPONSE = "Sorry, I only respond to authorized parents."
UNKNOWN_SPEAKER_RESPONSE = "Sorry. I only respond to Harish and his spouse."

_CHILD_DENIAL_RESPONSES: dict[ActionCategory, str] = {
    ActionCategory.HOME_AUTOMATION: (
        "That's something only a parent can do. Ask a grown-up to help with the lights."
    ),
    ActionCategory.SECURITY_ACTION: (
        "I can't lock or unlock doors for you. Please ask Mom or Dad."
    ),
    ActionCategory.PURCHASE: "I can't buy things. Only your parents can make purchases.",
}
_GENERIC_DENIAL_RESPONSE = "Sorry, you're not allowed to do that."


@dataclass(frozen=True)
class PermissionDecision:
    allowed: bool
    spoken_response: str
    reason: str


class PermissionPolicy:
    """Evaluates whether a role may perform an action category.

    An override map may be supplied (e.g. loaded from the database) to extend
    or restrict the defaults per deployment/family without code changes.
    """

    def __init__(
        self, overrides: dict[Role, frozenset[ActionCategory]] | None = None
    ) -> None:
        self._policy: dict[Role, frozenset[ActionCategory]] = dict(_DEFAULT_POLICY)
        if overrides:
            self._policy.update(overrides)

    def permitted_categories(self, role: Role) -> frozenset[ActionCategory]:
        return self._policy.get(role, frozenset())

    def is_allowed(self, role: Role, category: ActionCategory) -> bool:
        return category in self.permitted_categories(role)

    def evaluate(self, role: Role, category: ActionCategory) -> PermissionDecision:
        """Return a full decision including the response to speak on denial."""
        if self.is_allowed(role, category):
            return PermissionDecision(
                allowed=True, spoken_response="", reason="permitted"
            )

        if role is Role.UNKNOWN:
            return PermissionDecision(
                allowed=False,
                spoken_response=UNAUTHORIZED_SPEAKER_RESPONSE,
                reason="unauthorized_speaker",
            )

        if role is Role.CHILD:
            response = _CHILD_DENIAL_RESPONSES.get(category, _GENERIC_DENIAL_RESPONSE)
            return PermissionDecision(
                allowed=False, spoken_response=response, reason="child_mode_block"
            )

        return PermissionDecision(
            allowed=False,
            spoken_response=_GENERIC_DENIAL_RESPONSE,
            reason=f"{role.value}_not_permitted_{category.value}",
        )
