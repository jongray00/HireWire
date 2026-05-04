"""Auth router — internal endpoints used by the web layer.

Currently exposes ``POST /api/auth/validate-credentials``: the web layer
calls this during login to verify a SignalWire credential triple before
provisioning + persisting it.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from agent.lib.internal_auth import InternalCaller, require_internal_caller
from agent.lib.signalwire_client import SignalWireError, validate_credentials

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ValidateCredentialsRequest(BaseModel):
    space_url: str = Field(..., min_length=4, max_length=255)
    project_id: str = Field(..., min_length=8, max_length=255)
    api_token: str = Field(..., min_length=8, max_length=512)


class ValidateCredentialsResponse(BaseModel):
    valid: bool
    space_url: str


@router.post("/validate-credentials", response_model=ValidateCredentialsResponse)
def post_validate_credentials(
    body: ValidateCredentialsRequest,
    _caller: InternalCaller = Depends(require_internal_caller),
) -> ValidateCredentialsResponse:
    try:
        result = validate_credentials(body.space_url, body.project_id, body.api_token)
    except SignalWireError as exc:
        raise HTTPException(status_code=502, detail=f"signalwire upstream: {exc}") from exc
    return ValidateCredentialsResponse(valid=result.valid, space_url=result.space_url)
