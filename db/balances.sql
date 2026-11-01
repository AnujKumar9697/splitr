SELECT name, paid + sent - owed - received AS balance
FROM (
  SELECT u.user_id, u.name,
    COALESCE((SELECT SUM(amount_cents) FROM expenses WHERE paid_by = u.user_id), 0) AS paid,
    COALESCE((SELECT SUM(amount_cents) FROM expense_splits WHERE user_id = u.user_id), 0) AS owed,
    COALESCE((SELECT SUM(amount_cents) FROM settlements WHERE paid_by = u.user_id), 0) AS sent,
    COALESCE((SELECT SUM(amount_cents) FROM settlements WHERE paid_to = u.user_id), 0) AS received
  FROM users u
) t
ORDER BY user_id;