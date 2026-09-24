import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, engine
from .routers import alerts, sim, streams


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    await streams.seed_demo()

    from .sim.controller import controller as sim_controller

    task = asyncio.create_task(sim_controller.run())
    try:
        yield
    finally:
        sim_controller.running = False
        task.cancel()


app = FastAPI(title="Crash Response Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alerts.router)
app.include_router(streams.router)
app.include_router(sim.router)


@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}