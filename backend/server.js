const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const app = express();
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
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
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
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [groupId, newMember.user_id]
    );
    res.status(201).json(newMember);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'already a member' });
    }
    console.error(err);
    res.status(500).json({ error: 'something went wrong' });
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
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
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
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2::bigint[])',
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
         RETURNING expense_id, group_id, paid_by, amount_cents, description, expense_date`,
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

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});