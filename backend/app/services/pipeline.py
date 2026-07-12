"""The secure voice pipeline — the heart of ParentAI.

Orchestrates the strict security flow. **No protected action is ever executed
until (1) the wake word is detected and (2) the speaker is verified as an
authorized user.** The flow is:

    audio ─▶ transcribe ─▶ wake-word gate ─▶ speaker verification
          ─▶ authorization (role) ─▶ intent ─▶ permission (child mode)
          ─▶ execute (device / LLM) ─▶ spoken response

Every stage is audited. The orchestrator is provider-agnostic: it depends only
on the abstract provider interfaces and the pure permission policy, so any
provider can be swapped via configuration.
"""

from __future__ import annotations

import logging

from app.config import Settings
from app.domain.models import (
    ActionCategory,
    ConversationTurn,
    Intent,
    PipelineResult,
    Role,
)
from app.domain.permissions import (
    UNAUTHORIZED_SPEAKER_RESPONSE,
    PermissionPolicy,
)
from app.providers.base import (
    DeviceProvider,
    LLMProvider,
    SpeakerVerificationProvider,
    SpeechToTextProvider,
    WakeWordProvider,
)
from app.providers.wakeword.keyword import KeywordWakeWordProvider

from .audit import AuditLog
from .auth_service import AuthService
from .device_mapper import to_device_command
from .session_memory import SessionMemory

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You are ParentAI, a helpful and safe family voice assistant. Be concise. "
    "You are speaking to a verified household member."
)
_CHILD_SYSTEM_PROMPT = (
    "You are ParentAI talking to a child. Only answer educational, safe, and "
    "age-appropriate questions. Never help with purchases, security, or home "
    "controls. Keep answers short, friendly and encouraging."
)


class SecureVoicePipeline:
    def __init__(
        self,
        *,
        settings: Settings,
        wakeword: WakeWordProvider,
        stt: SpeechToTextProvider,
        speaker: SpeakerVerificationProvider,
        llm: LLMProvider,
        devices: DeviceProvider,
        auth: AuthService,
        policy: PermissionPolicy,
        memory: SessionMemory,
        audit: AuditLog,
    ) -> None:
        self._settings = settings
        self._wakeword = wakeword
        self._stt = stt
        self._speaker = speaker
        self._llm = llm
        self._devices = devices
        self._auth = auth
        self._policy = policy
        self._memory = memory
        self._audit = audit

    async def process(
        self, audio: bytes, *, session_id: str = "default"
    ) -> PipelineResult:
        stages: dict[str, object] = {}

        # 1) Transcribe.
        transcript = await self._stt.transcribe(audio)
        stages["transcript"] = transcript

        # 2) Wake-word gate. Nothing proceeds without it.
        if not await self._wakeword.detect(audio, hint=transcript):
            self._audit.record(
                "wakeword", outcome="ignored", session_id=session_id,
                detail={"transcript": transcript},
            )
            return PipelineResult(
                authorized=False,
                spoken_response="",
                denial_reason="no_wake_word",
                transcript=transcript,
                stages=stages,
            )
        stages["wakeword"] = True

        command_text = self._strip_wake_word(transcript)
        stages["command_text"] = command_text

        # 3) Speaker verification — the authorization gate.
        verification = await self._speaker.verify(
            audio,
            self._auth.authorized_candidates(),
            threshold=self._settings.speaker_confidence_threshold,
        )
        stages["verification"] = {
            "accepted": verification.accepted,
            "confidence": verification.confidence,
            "provider": verification.provider,
        }

        if not verification.is_authorized_speaker:
            self._audit.record(
                "speaker_verification",
                outcome="unauthorized",
                session_id=session_id,
                detail={
                    "confidence": verification.confidence,
                    "provider": verification.provider,
                    "command_text": command_text,
                },
            )
            return PipelineResult(
                authorized=False,
                spoken_response=UNAUTHORIZED_SPEAKER_RESPONSE,
                denial_reason="unauthorized_speaker",
                confidence=verification.confidence,
                transcript=transcript,
                stages=stages,
            )

        user = verification.user
        assert user is not None  # guaranteed by is_authorized_speaker
        self._audit.record(
            "speaker_verification",
            outcome="verified",
            user_id=user.id,
            role=user.role.value,
            session_id=session_id,
            detail={"confidence": verification.confidence},
        )

        # 4) Intent extraction.
        intent = await self._llm.extract_intent(command_text)
        stages["intent"] = {
            "category": intent.category.value,
            "action": intent.action,
            "target": intent.target,
        }

        # 5) Permission check (role-based; enforces child mode).
        decision = self._policy.evaluate(user.role, intent.category)
        if not decision.allowed:
            self._audit.record(
                "authorization",
                outcome="denied",
                user_id=user.id,
                role=user.role.value,
                session_id=session_id,
                detail={"category": intent.category.value, "reason": decision.reason},
            )
            return PipelineResult(
                authorized=True,  # speaker was authorized, but action was denied
                spoken_response=decision.spoken_response,
                user=user,
                intent=intent,
                executed=False,
                denial_reason=decision.reason,
                confidence=verification.confidence,
                transcript=transcript,
                stages=stages,
            )

        # 6) Execute.
        response = await self._execute(intent, user_role=user.role, session_id=session_id)
        self._audit.record(
            "execution",
            outcome="success",
            user_id=user.id,
            role=user.role.value,
            session_id=session_id,
            detail={"category": intent.category.value, "action": intent.action},
        )
        return PipelineResult(
            authorized=True,
            spoken_response=response,
            user=user,
            intent=intent,
            executed=True,
            confidence=verification.confidence,
            transcript=transcript,
            stages=stages,
        )

    # -- helpers --------------------------------------------------------
    def _strip_wake_word(self, transcript: str) -> str:
        if isinstance(self._wakeword, KeywordWakeWordProvider):
            return self._wakeword.strip_wake_word(transcript)
        # Best-effort strip for other providers.
        lowered = transcript.lower()
        for wake in self._settings.wake_words:
            idx = lowered.find(wake)
            if idx != -1:
                return transcript[idx + len(wake) :].lstrip(" ,.!?").strip()
        return transcript.strip()

    async def _execute(
        self, intent: Intent, *, user_role: Role, session_id: str
    ) -> str:
        if intent.category in (
            ActionCategory.HOME_AUTOMATION,
            ActionCategory.SECURITY_ACTION,
        ):
            command = to_device_command(intent)
            await self._devices.execute(command)
            return self._confirm(intent)

        if intent.category is ActionCategory.PURCHASE:
            # Commerce integration is out of scope; acknowledge explicitly.
            return (
                f"I've noted your request to {intent.action} "
                f"{intent.target or 'that item'}. Purchasing requires confirmation "
                "in the app."
            )

        # Conversational: educational or general query via the LLM with memory.
        return await self._converse(intent, user_role=user_role, session_id=session_id)

    async def _converse(
        self, intent: Intent, *, user_role: Role, session_id: str
    ) -> str:
        await self._memory.append(
            session_id, ConversationTurn(role="user", content=intent.utterance)
        )
        history = await self._memory.history(session_id)
        system = _CHILD_SYSTEM_PROMPT if user_role is Role.CHILD else _SYSTEM_PROMPT
        answer = await self._llm.respond(history, system_prompt=system)
        await self._memory.append(
            session_id, ConversationTurn(role="assistant", content=answer)
        )
        return answer

    @staticmethod
    def _confirm(intent: Intent) -> str:
        target = (intent.target or "the device").replace("_", " ")
        verb = {
            "turn_off": f"Turned off {target}.",
            "turn_on": f"Turned on {target}.",
            "lock": f"Locked {target}.",
            "unlock": f"Unlocked {target}.",
            "open": f"Opened {target}.",
            "close": f"Closed {target}.",
            "set_temperature": (
                f"Set {target} to {intent.parameters.get('temperature', '')}"
                " degrees."
            ),
            "set_brightness": (
                f"Set {target} brightness to "
                f"{intent.parameters.get('brightness', '')} percent."
            ),
        }
        return verb.get(intent.action, f"Done: {intent.action} {target}.")
