
-- CREATE TABLE IF NOT EXISTS users (
--   id SERIAL PRIMARY KEY,
--   email TEXT UNIQUE NOT NULL,
--   password_hash TEXT NOT NULL,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- INSERT INTO users (email, password_hash)
-- VALUES ('demo@example.com', 'hashed_demo_pw')
-- ON CONFLICT (email) DO NOTHING;

-- Extensions used by crypt()/bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table (add columns if missing)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns safely if the table existed with fewer cols
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='name') THEN
    ALTER TABLE users ADD COLUMN name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='is_active') THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END$$;

-- Sessions to store opaque tokens
CREATE TABLE IF NOT EXISTS sessions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

-- OPTIONAL seed (safe if exists)
INSERT INTO users (name, email, role, password_hash)
VALUES ('Demo', 'demo@example.com', 'homeowner', crypt('Abc123!', gen_salt('bf')))
ON CONFLICT (email) DO NOTHING;
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (email, password_hash)
VALUES ('demo@example.com', 'hashed_demo_pw')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  agent_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  size INT NOT NULL,              
  location TEXT NOT NULL,         
  floor INT,                      
  age INT,                        
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO properties (agent_id, size, location, floor, age)
VALUES (1, 1200, 'Orchard Road, District 9', 10, 5)
ON CONFLICT DO NOTHING;
