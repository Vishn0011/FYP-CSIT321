import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

@contextmanager
def get_cursor():
    with get_conn() as conn, conn.cursor() as cur:
        yield cur
        conn.commit()

def query_all(sql, params=None):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()

def execute(sql, params=None, return_row=False):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params or [])
        if return_row:
            try:
                return cur.fetchone()
            except Exception:
                return None
        conn.commit()

def query_one(sql, params=None):
    from app import get_cursor
    with get_cursor() as cur:
        cur.execute(sql, params or [])
        row = cur.fetchone()
        return dict(row) if row else None



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
