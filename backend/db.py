import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

def get_conn():
    """Create a new DB connection from DATABASE_URL."""
    return psycopg2.connect(os.getenv("DATABASE_URL"))

@contextmanager
def get_cursor():
    """Yield a regular cursor and commit when the block exits."""
    with get_conn() as conn, conn.cursor() as cur:
        try:
            yield cur
            conn.commit()
        except:
            conn.rollback()
            raise

def query_all(sql, params=None):
    """Run a SELECT and return all rows as dicts."""
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()

def execute(sql, params=None, return_row=False):
    """Run INSERT/UPDATE/DELETE. Optionally return one row as a dict."""
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or [])
        row = None
        if return_row:
            try:
                row = cur.fetchone()
            except Exception:
                row = None
        conn.commit()          # <-- IMPORTANT
        return row
