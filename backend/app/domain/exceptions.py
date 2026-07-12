"""Domain-level exceptions.

These are raised by the domain/service layers and translated to HTTP
responses at the API boundary (see :mod:`app.api.deps`).
"""

from __future__ import annotations


class ParentAIError(Exception):
    """Base class for all ParentAI domain errors."""


class UnauthorizedSpeakerError(ParentAIError):
    """Raised when the speaker cannot be verified as an authorized user."""


class PermissionDeniedError(ParentAIError):
    """Raised when a verified user lacks permission for the requested action."""

    def __init__(self, message: str, *, spoken_response: str) -> None:
        super().__init__(message)
        self.spoken_response = spoken_response


class WakeWordNotDetectedError(ParentAIError):
    """Raised when a request arrives without a valid wake word."""


class ProviderError(ParentAIError):
    """Raised when an external provider fails or is misconfigured."""


class EnrollmentError(ParentAIError):
    """Raised when a voice enrollment cannot be completed."""
