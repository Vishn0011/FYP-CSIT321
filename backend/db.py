import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


def get_conn():
    """Return a raw psycopg2 connection or None if it fails."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print("❌ Database connection error:", e)
        return None


def get_cursor():
    """
    Low-level helper: returns (conn, cur) using RealDictCursor.
    NOT a context manager. Used internally.
    """
    conn = get_conn()
    if conn is None:
        return None, None

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        return conn, cur
    except Exception as e:
        print("❌ Failed to create cursor:", e)
        conn.close()
        return None, None


@contextmanager
def get_cursor_cm():
    """
    High-level helper: proper context manager for:

        with get_cursor_cm() as cur:
            cur.execute(...)

    Automatically commits on success, rollbacks on error, and closes connection.
    """
    conn, cur = get_cursor()
    if cur is None:
        # Yield None so caller can handle it gracefully
        yield None
        return

    try:
        yield cur
        conn.commit()
    except Exception as e:
        print("❌ DB error in context manager:", e)
        conn.rollback()
        raise
    finally:
        conn.close()


def query_all(sql, params=None):
    """Run a SELECT that returns multiple rows."""
    conn, cur = get_cursor()
    if cur is None:
        return []

    try:
        cur.execute(sql, params)
        results = cur.fetchall()
        return results
    except Exception as e:
        print("❌ Query error (all):", e)
        return []
    finally:
        conn.close()


def query_one(sql, params=None):
    """Run a SELECT that returns a single row."""
    conn, cur = get_cursor()
    if cur is None:
        return None

    try:
        cur.execute(sql, params)
        result = cur.fetchone()
        return result
    except Exception as e:
        print("❌ Query error (one):", e)
        return None
    finally:
        conn.close()


def execute(sql, params=None, return_row=False):
    """
    Run INSERT/UPDATE/DELETE.
    - If return_row=False → returns True/False
    - If return_row=True  → returns one row (RealDict) or None on failure
    """
    conn, cur = get_cursor()
    if cur is None:
        return None if return_row else False

    try:
        cur.execute(sql, params)

        if return_row:
            row = cur.fetchone()
            conn.commit()
            return row

        conn.commit()
        return True

    except Exception as e:
        print("❌ Execution error:", e)
        conn.rollback()
        return None if return_row else False
    finally:
        conn.close()