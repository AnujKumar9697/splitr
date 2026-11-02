import { useState } from 'react';
import { api } from './api';
import { parseMoney } from './money';
 
function AddExpense({ groupId, members, onAdded }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(String(members[0].user_id));
  const [splitType, setSplitType] = useState('equal');
  const [selected, setSelected] = useState(members.map((m) => String(m.user_id)));
  const [percents, setPercents] = useState({});
  const [error, setError] = useState('');
 
  function toggle(id) {
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
 
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
 
    const amountCents = parseMoney(amount);
    if (!description.trim() || amountCents === null || amountCents <= 0) {
      setError('Enter a description and a valid amount like 250 or 250.50');
      return;
    }
 
    const body = {
      description: description.trim(),
      amount_cents: amountCents,
      paid_by: Number(paidBy),
      split_type: splitType,
    };
    if (splitType === 'equal') {
      body.participants = selected.map(Number);
    } else {
      body.shares = selected.map((id) => ({
        user_id: Number(id),
        percent: Number(percents[id]),
      }));
    }
 
    try {
      await api(`/groups/${groupId}/expenses`, { method: 'POST', body });
      setDescription('');
      setAmount('');
      setPercents({});
      onAdded();
    } catch (err) {
      setError(err.message);
    }
  }
 
  return (
    <form onSubmit={handleSubmit}>
      <h2>Add expense</h2>
 
      <div>
        <input
          placeholder="What was it for?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <input
          placeholder="Amount in rupees"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
 
      <div>
        Paid by{' '}
        <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          {members.map((m) => (
            <option key={m.user_id} value={String(m.user_id)}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
 
      <div>
        Split{' '}
        <select value={splitType} onChange={(e) => setSplitType(e.target.value)}>
          <option value="equal">equally</option>
          <option value="percentage">by percentage</option>
        </select>
      </div>
 
      <div>
        {members.map((m) => {
          const id = String(m.user_id);
          const isSelected = selected.includes(id);
          return (
            <div key={id}>
              <label>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(id)} /> {m.name}
              </label>
              {splitType === 'percentage' && isSelected && (
                <input
                  style={{ width: '4rem', marginLeft: '0.5rem' }}
                  placeholder="%"
                  value={percents[id] || ''}
                  onChange={(e) => setPercents({ ...percents, [id]: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
 
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <button type="submit">Save expense</button>
    </form>
  );
}
 
export default AddExpense;
 