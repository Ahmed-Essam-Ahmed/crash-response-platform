from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..realtime import realtime

router = APIRouter(tags=["stream"])


@router.websocket("/stream")
async def stream(ws: WebSocket):
    await realtime.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        realtime.disconnect(ws)
    except Exception:
        realtime.disconnect(ws)


@router.websocket("/ws")
async def stream_alias(ws: WebSocket):
    await stream(ws)
