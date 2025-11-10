import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# -----------------------------
# Simple shared connection
# -----------------------------
_conn = None

def get_conn():
    """
    Return a reused psycopg2 connection instead of creating
    a brand new one for every query.
    """
    global _conn
    if _conn is None or _conn.closed != 0:
        # You can add sslmode/etc in DATABASE_URL if needed.
        _conn = psycopg2.connect(DATABASE_URL)
    return _conn

@contextmanager
def get_cursor():
    """
    Yield a RealDictCursor and handle commit/rollback.
    Reuses the shared connection above.
    """
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()

# -----------------------------
# Helper functions
# -----------------------------

def query_all(sql, params=None):
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()

def execute(sql, params=None, return_row=False):
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        if return_row:
            row = cur.fetchone()
            return dict(row) if row else None
        # commit handled by get_cursor()

def query_one(sql, params=None):
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        row = cur.fetchone()
        return dict(row) if row else None
