"""User directory, voice enrollment, and login endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_container, require_admin
from app.container import Container
from app.domain.exceptions import EnrollmentError, ParentAIError
from app.schemas import EnrollResponse, TokenResponse, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    container: Container = Depends(get_container),
    _=Depends(require_admin),
) -> list[UserOut]:
    return [UserOut.from_user(u) for u in container.auth.list_users()]


@router.post("/{user_id}/enroll", response_model=EnrollResponse)
async def enroll_voice(
    user_id: str,
    sample: UploadFile = File(...),
    container: Container = Depends(get_container),
    _=Depends(require_admin),
) -> EnrollResponse:
    """Enroll a voice sample for a user, creating/updating their voice profile."""
    audio = await sample.read()
    try:
        user = await container.auth.enroll_voice(user_id, audio)
    except EnrollmentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ParentAIError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return EnrollResponse(
        user=UserOut.from_user(user),
        message=f"Enrolled voice sample for {user.name}.",
    )


@router.post("/{user_id}/enabled", response_model=UserOut)
async def set_enabled(
    user_id: str,
    enabled: bool,
    container: Container = Depends(get_container),
    _=Depends(require_admin),
) -> UserOut:
    try:
        user = container.auth.set_enabled(user_id, enabled)
    except ParentAIError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return UserOut.from_user(user)


@router.post("/{user_id}/token", response_model=TokenResponse)
async def issue_token(
    user_id: str, container: Container = Depends(get_container)
) -> TokenResponse:
    """Development login: issue a JWT for a known user id.

    In production this is replaced by the OAuth2 password/authorization-code
    flow; the token contract (sub + role claims) is identical.
    """
    try:
        token = container.auth.issue_token(user_id)
    except ParentAIError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return TokenResponse(access_token=token)
