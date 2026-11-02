import { useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './money';
import AddExpense from './AddExpense';
import RecordPayment from './RecordPayment';
import AddMember from './AddMember';
 
function signClass(cents) {
  if (cents > 0) return 'positive';
  if (cents < 0) return 'negative';
  return '';
}
 
function GroupPage({ groupId, groupName, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
 
  useEffect(() => {
    Promise.all([
      api(`/groups/${groupId}/balances`),
      api(`/groups/${groupId}/simplify`),
      api(`/groups/${groupId}/expenses`),
    ])
      .then(([balancesResult, simplifyResult, expensesResult]) => {
        setData({
          balances: balancesResult.balances,
          payments: simplifyResult.payments,
          expenses: expensesResult.expenses,
        });
      })
      .catch((err) => setError(err.message));
  }, [groupId, reloadKey]);
 
  const header = (
    <div className="row" style={{ margin: '20px 0 4px' }}>
      <button className="secondary" onClick={onBack}>
        ← Back
      </button>
      <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{groupName}</h1>
    </div>
  );
 
  if (error) {
    return (
      <div>
        {header}
        <p className="negative">{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        {header}
        <p className="muted">Loading...</p>
      </div>
    );
  }
 
  const names = {};
  for (const b of data.balances) {
    names[b.user_id] = b.name;
  }
  const reload = () => setReloadKey(reloadKey + 1);

    async function handleLeave() {
    if (!window.confirm(`Leave ${groupName}?`)) return;
    try {
      await api(`/groups/${groupId}/leave`, { method: 'POST' });
      onBack();
    } catch (err) {
      alert(err.message);
    }
  }
 
  return (
    <div>
      {header}
 
      <div className="grid-2">
        <div className="col">
          <div className="card">
            <h2>Balances</h2>
            <ul>
              {data.balances.map((b) => {
                const cents = Number(b.balance_cents);
                return (
                  <li key={b.user_id}>
                    <span>{b.name}</span>
                    <strong className={signClass(cents)}>{formatMoney(cents)}</strong>
                  </li>
                );
              })}
            </ul>
          </div>
 
          <div className="card">
            <h2>Suggested payments</h2>
            {data.payments.length === 0 && <p className="muted">Everyone is settled up.</p>}
            <ul>
              {data.payments.map((p, index) => (
                <li key={index}>
                  <span>
                    {names[p.from]} pays {names[p.to]}
                  </span>
                  <strong>{formatMoney(p.amount_cents)}</strong>
                </li>
              ))}
            </ul>
          </div>
 
          <div className="card">
            <h2>Expenses</h2>
            {data.expenses.length === 0 && <p className="muted">No expenses yet.</p>}
            <ul>
              {data.expenses.map((e) => (
                <li key={e.expense_id}>
                  <span>
                    {e.description}
                    <br />
                    <span className="muted">
                      Paid by {e.paid_by_name} on {e.expense_date}
                    </span>
                  </span>
                  <strong>{formatMoney(Number(e.amount_cents))}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
 
        <div className="col">
          <div className="card">
            <AddExpense groupId={groupId} members={data.balances} onAdded={reload} />
          </div>
 
          {data.balances.length > 1 && (
            <div className="card">
              <RecordPayment groupId={groupId} members={data.balances} onDone={reload} />
            </div>
          )}
 
          <div className="card">
            <AddMember groupId={groupId} onAdded={reload} />
          </div>
                    <div className="card">
            <h2>Leave group</h2>
            <p className="muted">You can leave only when your balance in this group is zero.</p>
            <button className="secondary" onClick={handleLeave}>
              Leave group
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
 
export default GroupPage;
 