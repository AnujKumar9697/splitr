import { useState } from 'react';
import { api } from './api';
import Login from './Login';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  function handleLoggedIn(loggedInUser) {
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }

  async function handleLogout() {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      // the token may already be expired, we still log out on this device
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  if (!user) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  return (
    <div>
      <h1>Hello, {user.name}</h1>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}

export default App;
