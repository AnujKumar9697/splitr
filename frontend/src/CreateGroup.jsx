import { useState } from 'react';
import { api } from './api';
 
function CreateGroup({ onCreated }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
 
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Give the group a name');
      return;
    }
    try {
      await api('/groups', { method: 'POST', body: { name: name.trim() } });
      setName('');
      onCreated();
    } catch (err) {
      setError(err.message);
    }
  }
 
  return (
    <form onSubmit={handleSubmit}>
      <h3>Create a group</h3>
      <input
        placeholder="Group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />{' '}
      <button type="submit">Create</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  );
}
 
export default CreateGroup;
 