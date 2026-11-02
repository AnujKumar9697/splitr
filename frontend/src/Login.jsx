import { useState } from 'react';
import { api } from './api';

function Login({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'register') {
        await api('/register', { method: 'POST', body: { name, email, password } });
      }
      const data = await api('/login', { method: 'POST', body: { email, password } });
      localStorage.setItem('token', data.token);
      onLoggedIn(data.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
      {mode === 'register' && (
        <div>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <div>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <p>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'I need an account' : 'I already have an account'}
        </button>
      </p>
    </form>
  );
}

export default Login;
