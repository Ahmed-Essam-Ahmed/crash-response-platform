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

TOKEN_TTL_HOURS = int(os.environ.get("TOKEN_TTL_HOURS", "720"))
PASSWORD_ITERATIONS = int(os.environ.get("PASSWORD_ITERATIONS", "240000"))

OFFER_WINDOW_MINUTES = float(os.environ.get("OFFER_WINDOW_MINUTES", "10"))
BROADCAST_AFTER_STAGES = int(os.environ.get("BROADCAST_AFTER_STAGES", "3"))
ESCALATION_TICK_SECONDS = float(os.environ.get("ESCALATION_TICK_SECONDS", "5"))

INGEST_API_KEY = os.environ.get("INGEST_API_KEY", "dev-ingest-key-change-me")

NOMINATIM_URL = os.environ.get("NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
NOMINATIM_TIMEOUT = float(os.environ.get("NOMINATIM_TIMEOUT", "6"))

SEED_DEMO_LOGIN = os.environ.get("SEED_DEMO_LOGIN", "1") == "1"
