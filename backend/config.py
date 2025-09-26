import os
from dotenv import load_dotenv

load_dotenv()

def _split_csv(v, default):
    raw = os.getenv(v, default)
    return [s.strip() for s in raw.split(",") if s.strip()]
    

PORT = int(os.getenv("PORT", "8000"))
DATABASE_URL = os.getenv("DATABASE_URL", "")
ALLOW_ORIGIN = os.getenv("ALLOW_ORIGIN", "http://localhost:5173")
SESSION_TTL_MIN = int(os.getenv("SESSION_TTL_MIN", "60"))  # login token lifetime
DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"
