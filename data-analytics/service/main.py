"""Data analytics service.

Read-only analytics over the incident database owned by hospital-website/backend.
Runs on port 8001 and feeds data-analytics/web.
"""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from analytics import load_incidents, summary

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "hospital-website" / "backend" / "incidents.db"
DB_PATH = os.environ.get("DB_PATH", str(DEFAULT_DB))

app = FastAPI(title="Crash Response Analytics", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "db": DB_PATH, "exists": Path(DB_PATH).exists()}


@app.get("/analytics/summary")
def get_summary():
    return summary(load_incidents(DB_PATH))


@app.get("/analytics/incidents")
def get_incidents():
    return load_incidents(DB_PATH)
