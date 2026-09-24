import asyncio
import sys
from pathlib import Path

from ..db import SessionLocal

ROOT = Path(__file__).resolve().parents[4]
for _sub in ("simulation", "ai-model"):
    _p = ROOT / _sub
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from world.world import World  # noqa: E402

TICK_SIM = 0.1


class SimController:
    def __init__(self):
        self.mode = "scripted"
        self.speed = 3.0
        self.world = World(mode=self.mode, seed=7, vehicles=10)
        self.running = True
        self._last_vs = 0.0

    def configure(self, mode: str = None, speed: float = None):
        changed = False
        if mode in ("scripted", "random") and mode != self.mode:
            self.mode = mode
            self.world = World(mode=mode, seed=7, vehicles=10)
            changed = True
        if speed and speed != self.speed:
            self.speed = max(0.5, min(20.0, float(speed)))
            changed = True
        return {"mode": self.mode, "speed": self.speed, "changed": changed}

    @property
    def config(self):
        return {"mode": self.mode, "speed": self.speed}

    async def run(self):
        import sys as _sys

        await self._broadcast_initial()
        while self.running:
            try:
                events = self.world.tick(TICK_SIM)
                for ev in events:
                    if ev["type"] == "vehicle_state":
                        await self._emit_vehicle(ev)
                    elif ev["type"] == "world_crash":
                        await self._handle_crash(ev)
            except Exception:
                e = _sys.exc_info()[1]
                print(f"[world] tick error: {type(e).__name__}: {e}", flush=True)

            if self.world.mode == "scripted" and self.world.script_crashed:
                if self.world.time > self.world.script_crash_time + 14.0:
                    self.world.reset(start=10)
                    self._last_vs = 0.0

            await asyncio.sleep(max(0.02, TICK_SIM / self.speed))

    async def _emit_vehicle(self, ev):
        if self.world.time - self._last_vs < 0.35:
            return
        self._last_vs = self.world.time
        await broadcast(ev)

    async def _handle_crash(self, ev):
        try:
            from detection.pipeline import DetectionPipeline

            detected = DetectionPipeline()._detect_window(ev["window"], ev["trip_id"], 0.0)
        except Exception:
            detected = None
        if not detected or not detected["detection"]["rule"]:
            return

        payload = {
            "trip_id": ev["trip_id"],
            "t": ev["window"][-1]["t"],
            "location": ev["location"],
            "severity": detected["severity"],
            "medical_profile_ref": ev["trip_id"],
            "detection": detected["detection"],
            "factors": detected["factors"],
        }
        db = SessionLocal()
        try:
            await create_alert_safe(payload, db)
        finally:
            db.close()

    async def _broadcast_initial(self):
        for v in self.world.vehicles:
            lat, lon = self.world.grid.position(v.a, v.b, v.progress)
            await broadcast({"type": "vehicle_state", "trip_id": v.trip_id,
                             "lat": lat, "lon": lon, "speed_mps": round(v.speed, 2),
                             "status": v.status})


async def create_alert_safe(payload, db):
    from ..services.alert_service import create_alert

    return await create_alert(payload, db)


async def broadcast(message):
    from ..routers.streams import manager

    await manager.broadcast(message)


controller = SimController()