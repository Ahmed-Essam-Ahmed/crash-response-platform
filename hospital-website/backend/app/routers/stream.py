from fastapi import APIRouter, WebSocket, WebSocketDisconnect, WebSocketException

from .. import models, security
from ..db import SessionLocal
from ..realtime import realtime

router = APIRouter(tags=["stream"])


def _authenticate(token: str | None):
    if not token:
        raise WebSocketException(code=4001, reason="missing token")
    db = SessionLocal()
    try:
        record = (
            db.query(models.AuthToken)
            .filter(models.AuthToken.token_hash == security.hash_token(token), models.AuthToken.revoked_at.is_(None))
            .first()
        )
        if record is None or not record.user.is_active or record.user.hospital is None:
            raise WebSocketException(code=4003, reason="invalid token")
        return record.user.hospital_id
    finally:
        db.close()


@router.websocket("/me/stream")
async def hospital_stream(ws: WebSocket, token: str = ""):
    hospital_id = _authenticate(token)
    await realtime.connect(ws, hospital_id)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        realtime.disconnect(ws, hospital_id)
    except Exception:
        realtime.disconnect(ws, hospital_id)
