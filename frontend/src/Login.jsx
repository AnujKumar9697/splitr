import { useState } from 'react';
import { api } from './api';
import Brand from './Brand';
 
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
    <div className="auth-wrap">
      <div className="auth-brand">
        <Brand size={48} />
        <p className="muted">Split expenses with friends, without the awkward maths.</p>
      </div>
 
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
        {mode === 'register' && (
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="negative">{error}</p>}
        <button type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'I need an account' : 'I already have an account'}
        </button>
      </form>
    </div>
  );
}
 
export default Login;
 