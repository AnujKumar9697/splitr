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

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});