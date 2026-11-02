import { useState } from 'react';
import { api } from './api';
 
function AddMember({ groupId, onAdded }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
 
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api(`/groups/${groupId}/members`, {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });
      setEmail('');
      onAdded();
    } catch (err) {
      setError(err.message);
    }
  }
 
  return (
    <form onSubmit={handleSubmit}>
      <h2>Add a member</h2>
      <input
        type="email"
        placeholder="Their email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />{' '}
      <button type="submit">Add</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  );
}
 
export default AddMember;
 