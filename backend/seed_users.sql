INSERT INTO users (name, email, role, password_hash, is_active)
VALUES
  ('Vishnu_Test_1', 'vishnu_test_1@example.com', 'homeowner', crypt('Abc123!', gen_salt('bf')), TRUE),
  ('Agent_One', 'agent1@example.com', 'agent', crypt('Abc123!', gen_salt('bf')), TRUE)
ON CONFLICT (email) DO NOTHING;
