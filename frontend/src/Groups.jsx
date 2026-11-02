import { useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './money';
import PaymentHistory from './PaymentHistory';
import CreateGroup from './CreateGroup';
 
function Groups({ onOpenGroup }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
 
  useEffect(() => {
    api('/summary')
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [reloadKey]);
 
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
 
      <CreateGroup onCreated={() => setReloadKey(reloadKey + 1)} />
 
      <PaymentHistory />
    </div>
  );
}
 
export default Groups;
 