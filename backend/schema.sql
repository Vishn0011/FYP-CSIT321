
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

-- Saved properties for homeowners
-- A simple pivot table that tracks which user saved which property.
-- Enforces uniqueness so the same property is not saved twice by a user.
CREATE TABLE IF NOT EXISTS saved_properties (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, property_id)
);
-- Property agent verification submissions
CREATE TABLE IF NOT EXISTS agent_applications (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cea_reg_no TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  agency_license_no TEXT NOT NULL,
  years_experience INT,
  id_last4 TEXT,
  supporting_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
