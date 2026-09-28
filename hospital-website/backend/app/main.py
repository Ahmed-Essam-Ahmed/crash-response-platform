import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, DATABASE_URL
from .db import SessionLocal, engine
from .models import Base
from .realtime import realtime
from .routers import fleet, hospitals, incidents, stream
from .services import demo_source, progression, registry


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        registry.seed(db)
    finally:
        db.close()

    tasks = [asyncio.create_task(progression.run())]
    if demo_source.enabled():
        tasks.append(asyncio.create_task(demo_source.run()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()


app = FastAPI(
    title="Hospital Response Service",
    version="2.0.0",
    description="Receives crash reports, runs the incident lifecycle, and coordinates ambulances and hospitals.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router)
app.include_router(hospitals.router)
app.include_router(fleet.router)
app.include_router(stream.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "hospital-response",
        "database": DATABASE_URL,
        "stream_clients": realtime.clients,
        "time": datetime.utcnow().isoformat(),
    }


@app.get("/")
def index():
    return {
        "service": "hospital-response",
        "endpoints": {
            "report_crash": "POST /incidents",
            "incidents": "GET /incidents",
            "active_incidents": "GET /incidents/active",
            "hospitals": "GET /hospitals",
            "fleet": "GET /fleet",
            "stream": "WS /stream",
        },
    }
