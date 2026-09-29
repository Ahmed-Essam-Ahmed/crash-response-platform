from fastapi import WebSocket


class Realtime:
    """WebSocket registry keyed by hospital, so a broadcast can never cross tenants."""

    def __init__(self) -> None:
        self._clients: dict[str, set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, hospital_id: int | str | None) -> None:
        await ws.accept()
        self._clients.setdefault(self._key(hospital_id), set()).add(ws)

    def disconnect(self, ws: WebSocket, hospital_id: int | str | None = None) -> None:
        bucket = self._clients.get(self._key(hospital_id))
        if bucket is not None:
            bucket.discard(ws)
            if not bucket:
                self._clients.pop(self._key(hospital_id), None)

    async def broadcast(self, message: dict, hospital_id: int | str | None = None) -> int:
        return await self._send(self._key(hospital_id), message)

    async def broadcast_all(self, message: dict) -> int:
        sent = 0
        for key in list(self._clients):
            sent += await self._send(key, message)
        return sent

    async def _send(self, key: str, message: dict) -> int:
        bucket = self._clients.get(key)
        if not bucket:
            return 0
        dead = []
        for ws in list(bucket):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            bucket.discard(ws)
        return len(bucket)

    @staticmethod
    def _key(hospital_id: int | str | None) -> str:
        return str(hospital_id) if hospital_id is not None else "__public__"

    @property
    def clients(self) -> int:
        return sum(len(bucket) for bucket in self._clients.values())

    @property
    def hospitals(self) -> int:
        return len([k for k in self._clients if k != "__public__"])


realtime = Realtime()
