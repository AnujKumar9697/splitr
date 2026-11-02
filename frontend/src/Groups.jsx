import { useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './money';
import PaymentHistory from './PaymentHistory';
import CreateGroup from './CreateGroup';
 
function signClass(cents) {
  if (cents > 0) return 'positive';
  if (cents < 0) return 'negative';
  return '';
}
 
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
    return <p className="negative">{error}</p>;
  }
  if (!summary) {
    return <p className="muted">Loading...</p>;
  }
 
  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="label">Total balance</div>
          <div className={`value ${signClass(summary.total_cents)}`}>
            {formatMoney(summary.total_cents)}
          </div>
        </div>
        <div className="stat">
          <div className="label">You are owed</div>
          <div className="value positive">{formatMoney(summary.owed_to_you_cents)}</div>
        </div>
        <div className="stat">
          <div className="label">You owe</div>
          <div className="value negative">{formatMoney(summary.you_owe_cents)}</div>
        </div>
      </div>
 
      <div className="grid-2">
        <div className="col">
          <div className="card">
            <h2>Your groups</h2>
            {summary.groups.length === 0 && (
              <p className="muted">You are not in any group yet. Create one on the right.</p>
            )}
            <ul>
              {summary.groups.map((g) => (
                <li key={g.group_id}>
                  <span>{g.name}</span>
                  <span className="row">
                    <span className={signClass(g.balance_cents)}>
                      {formatMoney(g.balance_cents)}
                    </span>
                    <button className="secondary" onClick={() => onOpenGroup(g)}>
                      Open
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
 
        <div className="col">
          <div className="card">
            <CreateGroup onCreated={() => setReloadKey(reloadKey + 1)} />
          </div>
          <div className="card">
            <PaymentHistory />
          </div>
        </div>
      </div>
    </div>
  );
}
 
export default Groups;
 