import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from contextlib import contextmanager

load_dotenv()

def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

@contextmanager
def get_cursor():
    with get_conn() as conn, conn.cursor() as cur:
        yield cur
        conn.commit()

def query_all(sql, params=None):
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()

def execute(sql, params=None, return_row=False):
    with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params or [])
        if return_row:
            try:
                return cur.fetchone()
            except Exception:
                return None
<<<<<<< HEAD
=======
        conn.commit()


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
>>>>>>> origin/development
