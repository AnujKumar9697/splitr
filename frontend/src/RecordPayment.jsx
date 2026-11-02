import { useState } from 'react';
import { api } from './api';
import { parseMoney } from './money';
 
function RecordPayment({ groupId, members, onDone }) {
  const me = JSON.parse(localStorage.getItem('user'));
  const others = members.filter((m) => String(m.user_id) !== String(me.user_id));
 
  const [paidTo, setPaidTo] = useState(others.length > 0 ? String(others[0].user_id) : '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
 
  if (others.length === 0) {
    return null;
  }
 
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
 
    const amountCents = parseMoney(amount);
    if (amountCents === null || amountCents <= 0) {
      setError('Enter a valid amount like 250 or 250.50');
      return;
    }
 
    try {
      await api(`/groups/${groupId}/settlements`, {
        method: 'POST',
        body: { paid_to: Number(paidTo), amount_cents: amountCents },
      });
      setAmount('');
      onDone();
    } catch (err) {
      setError(err.message);
    }
  }
 
  return (
    <form onSubmit={handleSubmit}>
      <h2>Record a payment you made</h2>
      <div>
        I paid{' '}
        <select value={paidTo} onChange={(e) => setPaidTo(e.target.value)}>
          {others.map((m) => (
            <option key={m.user_id} value={String(m.user_id)}>
              {m.name}
            </option>
          ))}
        </select>{' '}
        <input
          style={{ width: '6rem' }}
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">Save payment</button>
    </form>
  );
}
 
export default RecordPayment;
 