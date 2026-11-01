const express = require('express');
const pool = require('./db');
const app = express();

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

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});