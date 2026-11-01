INSERT INTO users (name, email) VALUES
  ('A', 'a@example.com'),
  ('B', 'b@example.com'),
  ('C', 'c@example.com'),
  ('D', 'd@example.com');

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