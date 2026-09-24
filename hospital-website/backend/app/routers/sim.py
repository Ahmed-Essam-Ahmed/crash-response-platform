from fastapi import APIRouter
from pydantic import BaseModel

from ..sim.controller import controller
from ..routers.streams import manager

router = APIRouter(prefix="/sim", tags=["sim"])


class SimConfig(BaseModel):
    mode: str = None
    speed: float = None


@router.post("/config")
def set_config(cfg: SimConfig):
    return controller.configure(mode=cfg.mode, speed=cfg.speed)


@router.get("/config")
def get_config():
    return controller.config


@router.post("/mode")
def set_mode(mode: str):
    return controller.configure(mode=mode)


@router.post("/connections")
def connections():
    return {"active": len(manager.active)}