import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .. import models
from ..db import SessionLocal

router = APIRouter(tags=["streams"])


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


async def seed_demo():
    db = SessionLocal()
    try:
        if db.query(models.Hospital).count() == 0:
            db.add_all([
                models.Hospital(code="hosp-01", lat=30.0300, lon=31.2400, capacity=5),
                models.Hospital(code="hosp-02", lat=30.0500, lon=31.2200, capacity=6),
                models.Hospital(code="hosp-03", lat=30.0600, lon=31.2600, capacity=4),
            ])
            db.commit()
    finally:
        db.close()


async def broadcaster(events: asyncio.Queue):
    while True:
        message = await events.get()
        await manager.broadcast(message)