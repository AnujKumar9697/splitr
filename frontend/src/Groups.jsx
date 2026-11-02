import { useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './money';
 
function Groups({ onOpenGroup }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
 
  useEffect(() => {
    api('/summary')
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);
 
  if (error) {
    return <p style={{ color: 'crimson' }}>{error}</p>;
  }
  if (!summary) {
    return <p>Loading...</p>;
  }
 
  return (
    <div>
      <h2>Total balance</h2>
      <p style={{ fontSize: '2rem', margin: 0 }}>{formatMoney(summary.total_cents)}</p>
      <p>
        You are owed {formatMoney(summary.owed_to_you_cents)} and you owe{' '}
        {formatMoney(summary.you_owe_cents)}
      </p>
 
      <h3>Your groups</h3>
      {summary.groups.length === 0 && <p>You are not in any group yet.</p>}
      <ul>
        {summary.groups.map((g) => (
          <li key={g.group_id}>
            {g.name}: {formatMoney(g.balance_cents)}{' '}
            <button onClick={() => onOpenGroup(g.group_id)}>Open</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
 
export default Groups;
 