import asyncio

from ..config import ESCALATION_TICK_SECONDS
from ..db import SessionLocal
from ..realtime import realtime
from . import offers


async def run() -> None:
    """Walk timed-out offers on to the next nearest hospital."""
    while True:
        try:
            await asyncio.sleep(ESCALATION_TICK_SECONDS)
            db = SessionLocal()
            try:
                moved = offers.escalate_once(db)
                closed = offers.expire_lapsed_broadcasts(db)
            finally:
                db.close()
            for change in moved:
                await realtime.broadcast_all({"type": "case_escalated", **change})
            for alert_id in closed:
                await realtime.broadcast_all({"type": "case_unclaimed", "alert_id": alert_id})
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(ESCALATION_TICK_SECONDS)
