import os
import atexit
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
POOL_MIN = int(os.getenv("DB_POOL_MIN", 1))
POOL_MAX = int(os.getenv("DB_POOL_MAX", 10))

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

_pool = SimpleConnectionPool(
    POOL_MIN,
    POOL_MAX,
    DATABASE_URL,
    cursor_factory=RealDictCursor,
)


def _get_connection():
    if _pool is None:
        raise RuntimeError("Database connection pool was not initialised")
    return _pool.getconn()


def _put_connection(conn):
    if _pool is not None and conn is not None:
        _pool.putconn(conn)


@contextmanager
def get_cursor():
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            yield cur
            conn.commit()
    finally:
        _put_connection(conn)


@contextmanager
def get_conn():
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        _put_connection(conn)

    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()

# -----------------------------
# Helper functions
# -----------------------------

def query_all(sql, params=None):
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            return cur.fetchall()
    finally:
        _put_connection(conn)


def execute(sql, params=None, return_row=False):
    conn = _get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or [])
            if return_row:
                try:
                    row = cur.fetchone()
                except Exception:
                    row = None
                conn.commit()
                return row
            conn.commit()
    finally:
        _put_connection(conn)


def query_one(sql, params=None):
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        row = cur.fetchone()
        return dict(row) if row else None


@atexit.register
def _close_pool():
    if _pool is not None:
        _pool.closeall()



# def query_all(sql, params=None):
#     with get_conn() as conn, conn.cursor() as cur:
#         cur.execute(sql, params or [])
#         return cur.fetchall()

# def execute(sql, params=None, return_row=False):
#     with get_conn() as conn, conn.cursor() as cur:
#         cur.execute(sql, params or [])
#         if return_row:
#             try:
#                 return cur.fetchone()
#             except Exception:
#                 return None
#         conn.commit()
