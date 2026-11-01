INSERT INTO users (name, email, password_hash) VALUES
  ('A', 'a@example.com', 'seed-not-a-real-hash'),
  ('B', 'b@example.com', 'seed-not-a-real-hash'),
  ('C', 'c@example.com', 'seed-not-a-real-hash'),
  ('D', 'd@example.com', 'seed-not-a-real-hash');

INSERT INTO groups (name, created_by) VALUES ('Goa Trip', 1);

INSERT INTO group_members (group_id, user_id) VALUES
  (1, 1),
  (1, 2),
  (1, 3);

INSERT INTO expenses (group_id, paid_by, amount_cents, description) VALUES
  (1, 1, 300000, 'Hotel');

INSERT INTO expense_splits (expense_id, user_id, amount_cents) VALUES
  (1, 1, 100000),
  (1, 2, 100000),
  (1, 3, 100000);