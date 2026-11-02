import { useState } from 'react';
import { api } from './api';
import Login from './Login';
import Groups from './Groups';
import GroupPage from './GroupPage';
 
function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [openGroupId, setOpenGroupId] = useState(null);
 
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
    setOpenGroupId(null);
    setUser(null);
  }
 
  if (!user) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }
 
  return (
    <div>
      <p>
        Logged in as {user.name} <button onClick={handleLogout}>Log out</button>
      </p>
 
      {openGroupId === null ? (
        <Groups onOpenGroup={setOpenGroupId} />
      ) : (
        <GroupPage groupId={openGroupId} onBack={() => setOpenGroupId(null)} />
      )}
    </div>
  );
}
 
export default App;
 