const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const app = express();
const cors = require('cors');
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

const crypto = require('crypto');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing token' });
  }

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.user_id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'invalid or expired token' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
}

app.get('/', (req, res) => {
  res.send('Splitwise backend is running');
});

app.get('/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT now() AS time');
    res.json({ ok: true, time: result.rows[0].time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Database connection failed' });
  }
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, name, email',
      [name, email.toLowerCase(), passwordHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT user_id, name, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    const passwordOk = user && (await bcrypt.compare(password, user.password_hash));

    if (!passwordOk) {
      return res.status(401).json({ error: 'invalid email or password' });
    }

        const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.user_id, hashToken(token), expiresAt]
    );

    res.json({
      token,
      user: { user_id: user.user_id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

app.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

app.post('/logout', requireAuth, async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  try {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

app.post('/groups', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'group name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const groupResult = await client.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING group_id, name, created_at',
      [name, req.user.user_id]
    );
    const group = groupResult.rows[0];
    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.group_id, req.user.user_id]
    );
    await client.query('COMMIT');
    res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  } finally {
    client.release();
  }
});

app.post('/groups/:groupId/members', requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  const { email } = req.body;
  if (!Number.isInteger(groupId) || !email) {
    return res.status(400).json({ error: 'valid group id and email are required' });
  }

  try {
    const membership = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, req.user.user_id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }

    const userResult = await pool.query(
      'SELECT user_id, name, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'no user with that email' });
    }

        const newMember = userResult.rows[0];

    // first try to bring back someone who left earlier
    const rejoin = await pool.query(
      'UPDATE group_members SET left_at = NULL WHERE group_id = $1 AND user_id = $2 AND left_at IS NOT NULL',
      [groupId, newMember.user_id]
    );
    // no old row came back, so this person is brand new to the group
    if (rejoin.rowCount === 0) {
      await pool.query(
        'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
        [groupId, newMember.user_id]
      );
    }
    res.status(201).json(newMember);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'already a member' });
    }
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
  }
});

app.post('/groups/:groupId/leave', requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ error: 'invalid group id' });
  }

  try {
    const balances = await getGroupBalances(groupId);
    const mine = balances.find((b) => Number(b.user_id) === Number(req.user.user_id));
    if (!mine) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }
    if (Number(mine.balance_cents) !== 0) {
      return res.status(400).json({ error: 'settle your balance before leaving this group' });
    }

    await pool.query(
      'UPDATE group_members SET left_at = now() WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, req.user.user_id]
    );
    res.status(200).json({ message: 'you left the group' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

function splitEqually(totalCents, userIds) {
  const base = Math.floor(totalCents / userIds.length);
  const remainder = totalCents % userIds.length;
  return userIds.map((user_id, i) => ({
    user_id,
    amount_cents: base + (i < remainder ? 1 : 0),
  }));
}

function splitByPercent(totalCents, shares) {
  const result = shares.map((s) => ({
    user_id: s.user_id,
    amount_cents: Math.floor((totalCents * s.percent) / 100),
  }));

  let leftover = totalCents - result.reduce((sum, r) => sum + r.amount_cents, 0);
  for (let i = 0; leftover > 0; i++, leftover--) {
    result[i].amount_cents += 1;
  }
  return result;
}

function simplifyDebts(balances) {
  const people = balances.map((b) => ({
    user_id: b.user_id,
    balance: Number(b.balance_cents),
  }));
  const payments = [];

  while (people.length >= 2) {
    people.sort((a, b) => a.balance - b.balance);
    const debtor = people[0];
    const creditor = people[people.length - 1];
    if (debtor.balance >= 0 || creditor.balance <= 0) break;

    const amount = Math.min(-debtor.balance, creditor.balance);
    payments.push({ from: debtor.user_id, to: creditor.user_id, amount_cents: amount });
    debtor.balance += amount;
    creditor.balance -= amount;
  }
  return payments;
}

app.post('/groups/:groupId/expenses', requireAuth, async (req, res) => {
  const { description, amount_cents, paid_by, split_type } = req.body;

  if (
    !description ||
    !Number.isInteger(amount_cents) || amount_cents <= 0 ||
    !Number.isInteger(paid_by) ||
    !['equal', 'percentage'].includes(split_type)
  ) {
    return res.status(400).json({ error: 'invalid expense fields' });
  }

    const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ error: 'invalid group id' });
  }

  try {
    const member = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, req.user.user_id]
    );
    if (member.rowCount === 0) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }

        const { participants, shares } = req.body;
    const userIds = split_type === 'equal'
      ? participants
      : (Array.isArray(shares) ? shares.map((s) => s.user_id) : null);

    if (
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      !userIds.every(Number.isInteger) ||
      new Set(userIds).size !== userIds.length
    ) {
      return res.status(400).json({ error: 'invalid participants' });
    }

    const involved = [...new Set([paid_by, ...userIds])];
    const found = await pool.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2::bigint[]) AND left_at IS NULL',
      [groupId, involved]
    );
    if (found.rowCount !== involved.length) {
      return res.status(400).json({ error: 'payer and participants must all be group members' });
    }

    let splits;
    if (split_type === 'equal') {
      splits = splitEqually(amount_cents, userIds);
    } else {
      const wholePercents = shares.every((s) => Number.isInteger(s.percent) && s.percent > 0);
      const totalPercent = shares.reduce((sum, s) => sum + s.percent, 0);
      if (!wholePercents || totalPercent !== 100) {
        return res.status(400).json({ error: 'percents must be whole numbers adding up to 100' });
      }
      splits = splitByPercent(amount_cents, shares);
    }

        const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expense = await client.query(
        `INSERT INTO expenses (group_id, paid_by, amount_cents, description)
         VALUES ($1, $2, $3, $4)
                  RETURNING expense_id, group_id, paid_by, amount_cents, description,
                   to_char(expense_date, 'YYYY-MM-DD') AS expense_date`,
        [groupId, paid_by, amount_cents, description]
      );
      const expenseId = expense.rows[0].expense_id;

      for (const s of splits) {
        await client.query(
          'INSERT INTO expense_splits (expense_id, user_id, amount_cents) VALUES ($1, $2, $3)',
          [expenseId, s.user_id, s.amount_cents]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({ expense: expense.rows[0], splits });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

async function getGroupBalances(groupId) {
  const result = await pool.query(
    `SELECT m.user_id, u.name,
       COALESCE((SELECT SUM(e.amount_cents) FROM expenses e
                 WHERE e.group_id = m.group_id AND e.paid_by = m.user_id), 0)
       - COALESCE((SELECT SUM(s.amount_cents) FROM expense_splits s
                   JOIN expenses e ON e.expense_id = s.expense_id
                   WHERE e.group_id = m.group_id AND s.user_id = m.user_id), 0)
       + COALESCE((SELECT SUM(t.amount_cents) FROM settlements t
                   WHERE t.group_id = m.group_id AND t.paid_by = m.user_id), 0)
       - COALESCE((SELECT SUM(t.amount_cents) FROM settlements t
                   WHERE t.group_id = m.group_id AND t.paid_to = m.user_id), 0)
       AS balance_cents
     FROM group_members m
     JOIN users u ON u.user_id = m.user_id
     WHERE m.group_id = $1 AND m.left_at IS NULL
     ORDER BY m.user_id`,
    [groupId]
  );
  return result.rows;
}

app.get('/groups/:groupId/balances', requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ error: 'invalid group id' });
  }

  try {
    const member = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, req.user.user_id]
    );
    if (member.rowCount === 0) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }

    const balances = await getGroupBalances(groupId);
    res.status(200).json({ balances });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/groups/:groupId/settlements', requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  const { paid_to, amount_cents } = req.body;

  if (
    !Number.isInteger(groupId) ||
    !Number.isInteger(paid_to) ||
    !Number.isInteger(amount_cents) || amount_cents <= 0
  ) {
    return res.status(400).json({ error: 'invalid settlement fields' });
  }
    if (paid_to === Number(req.user.user_id)) {
    return res.status(400).json({ error: 'you cannot pay yourself' });
  }

  try {
    const found = await pool.query(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2::bigint[]) AND left_at IS NULL',
      [groupId, [req.user.user_id, paid_to]]
    );
    const memberIds = found.rows.map((r) => Number(r.user_id));
    if (!memberIds.includes(Number(req.user.user_id))) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }
    if (!memberIds.includes(paid_to)) {
      return res.status(400).json({ error: 'the receiver is not a member of this group' });
    }

    const result = await pool.query(
      `INSERT INTO settlements (group_id, paid_by, paid_to, amount_cents)
       VALUES ($1, $2, $3, $4)
       RETURNING settlement_id, group_id, paid_by, paid_to, amount_cents`,
      [groupId, req.user.user_id, paid_to, amount_cents]
    );
    res.status(201).json({ settlement: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/groups/:groupId/simplify', requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ error: 'invalid group id' });
  }

  try {
    const member = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, req.user.user_id]
    );
    if (member.rowCount === 0) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }

    const balances = await getGroupBalances(groupId);
    const payments = simplifyDebts(balances);
    res.status(200).json({ payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/groups', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.group_id, g.name
       FROM groups g
       JOIN group_members m ON m.group_id = g.group_id
       WHERE m.user_id = $1 AND m.left_at IS NULL AND m.left_at IS NULL
       ORDER BY g.group_id`,
      [req.user.user_id]
    );
    res.status(200).json({ groups: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/groups/:groupId/expenses', requireAuth, async (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!Number.isInteger(groupId)) {
    return res.status(400).json({ error: 'invalid group id' });
  }

  try {
    const member = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, req.user.user_id]
    );
    if (member.rowCount === 0) {
      return res.status(403).json({ error: 'you are not a member of this group' });
    }

    const result = await pool.query(
      `SELECT e.expense_id, e.description, e.amount_cents, e.paid_by,
              u.name AS paid_by_name,
              to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date
       FROM expenses e
       JOIN users u ON u.user_id = e.paid_by
       WHERE e.group_id = $1
       ORDER BY e.expense_date DESC, e.expense_id DESC`,
      [groupId]
    );
    res.status(200).json({ expenses: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/summary', requireAuth, async (req, res) => {
  try {
    const myId = Number(req.user.user_id);
    const groupsResult = await pool.query(
      `SELECT g.group_id, g.name
       FROM groups g
       JOIN group_members m ON m.group_id = g.group_id
       WHERE m.user_id = $1 AND m.left_at IS NULL AND m.left_at IS NULL
       ORDER BY g.group_id`,
      [myId]
    );

    const groups = [];
    for (const g of groupsResult.rows) {
      const balances = await getGroupBalances(Number(g.group_id));
      const mine = balances.find((b) => Number(b.user_id) === myId);
      groups.push({
        group_id: g.group_id,
        name: g.name,
        balance_cents: mine ? Number(mine.balance_cents) : 0,
      });
    }

    const total = groups.reduce((sum, g) => sum + g.balance_cents, 0);
    const owedToYou = groups.filter((g) => g.balance_cents > 0).reduce((sum, g) => sum + g.balance_cents, 0);
    const youOwe = groups.filter((g) => g.balance_cents < 0).reduce((sum, g) => sum - g.balance_cents, 0);

    res.status(200).json({
      total_cents: total,
      owed_to_you_cents: owedToYou,
      you_owe_cents: youOwe,
      groups,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/payments', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.settlement_id, g.name AS group_name,
              t.paid_by, p.name AS paid_by_name,
              t.paid_to, r.name AS paid_to_name,
              t.amount_cents,
              to_char(t.settled_on, 'YYYY-MM-DD') AS settled_on
       FROM settlements t
       JOIN groups g ON g.group_id = t.group_id
       JOIN users p ON p.user_id = t.paid_by
       JOIN users r ON r.user_id = t.paid_to
       WHERE t.paid_by = $1 OR t.paid_to = $1
       ORDER BY t.settled_on DESC, t.settlement_id DESC`,
      [req.user.user_id]
    );
    res.status(200).json({ payments: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});