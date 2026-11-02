import { useState } from 'react';
import { api } from './api';
import Brand from './Brand';
import Login from './Login';
import Groups from './Groups';
import GroupPage from './GroupPage';
 
function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [openGroup, setOpenGroup] = useState(null);
 
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
    setOpenGroup(null);
    setUser(null);
  }
 
  if (!user) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }
 
  return (
    <div>
      <header className="topbar">
        <Brand />
        <div className="user">
          <span style={{ fontWeight: 500 }}>Hi, {user.name}</span>
          <button className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
 
      {openGroup === null ? (
        <Groups onOpenGroup={setOpenGroup} />
      ) : (
        <GroupPage
          groupId={openGroup.group_id}
          groupName={openGroup.name}
          onBack={() => setOpenGroup(null)}
        />
      )}
    </div>
  );
}
 
export default App;
 