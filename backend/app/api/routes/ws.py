"""WebSocket endpoint for streaming conversational responses.

Clients send a JSON message ``{"text": "...", "speaker": "harish",
"session_id": "..."}``. The server runs the full secure pipeline and, for
authorized conversational intents, streams the assistant response chunk by
chunk. Denials are sent as a single final message — a denied request is never
streamed as if it were being fulfilled.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.container import Container
from app.domain.models import ActionCategory, ConversationTurn, Role
from app.providers.textmode import encode as encode_textmode

router = APIRouter()


@router.websocket("/ws/voice")
async def ws_voice(websocket: WebSocket) -> None:
    await websocket.accept()
    container: Container = websocket.app.state.container
    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)
            audio = encode_textmode(
                payload.get("text", ""),
                speaker=payload.get("speaker"),
                confidence=float(payload.get("confidence", 0.99)),
            )
            session_id = payload.get("session_id", "default")
            result = await container.pipeline.process(audio, session_id=session_id)

            # Denied or non-conversational → single terminal message.
            conversational = result.intent is not None and result.intent.category in (
                ActionCategory.GENERAL_QUERY,
                ActionCategory.EDUCATIONAL_QUERY,
            )
            if not result.executed or not conversational:
                await websocket.send_json(
                    {"type": "final", "text": result.spoken_response,
                     "authorized": result.authorized, "executed": result.executed}
                )
                continue

            # Authorized conversational intent → stream the response.
            history = [ConversationTurn(role="user", content=result.intent.utterance)]
            system = (
                "You are ParentAI, a safe family assistant."
                if result.user and result.user.role is not Role.CHILD
                else "You are ParentAI talking to a child; keep it educational and safe."
            )
            await websocket.send_json({"type": "start"})
            async for chunk in container.llm.stream(history, system_prompt=system):
                await websocket.send_json({"type": "delta", "text": chunk})
            await websocket.send_json({"type": "final", "text": "", "executed": True})
    except WebSocketDisconnect:
        return
