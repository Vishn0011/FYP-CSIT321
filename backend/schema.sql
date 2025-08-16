
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, password_hash)
VALUES ('demo@example.com', 'hashed_demo_pw')
ON CONFLICT (email) DO NOTHING;

