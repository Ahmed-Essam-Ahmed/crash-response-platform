import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DATA_DIR / 'hospital.db'}")
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

PROGRESSION_TICK_SECONDS = 0.5
TIME_SCALE = float(os.environ.get("TIME_SCALE", "8.0"))

ON_SCENE_SECONDS = 20.0
HANDOVER_SECONDS = 12.0

DEMO_SOURCE = os.environ.get("DEMO_SOURCE", "off")
