import { useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './money';
import AddExpense from './AddExpense';
import RecordPayment from './RecordPayment';
import AddMember from './AddMember';
 
function GroupPage({ groupId, onBack }) {
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
 
  if (error) {
    return (
      <div>
        <button onClick={onBack}>Back to groups</button>
        <p style={{ color: 'crimson' }}>{error}</p>
      </div>
    );
  }
  if (!data) {
    return <p>Loading...</p>;
  }
 
  const names = {};
  for (const b of data.balances) {
    names[b.user_id] = b.name;
  }
 
  return (
    <div>
      <button onClick={onBack}>Back to groups</button>
 
      <h2>Balances</h2>
      <ul>
        {data.balances.map((b) => (
          <li key={b.user_id}>
            {b.name}: {formatMoney(Number(b.balance_cents))}
          </li>
        ))}
      </ul>
 
      <h2>Suggested payments</h2>
      {data.payments.length === 0 && <p>Everyone is settled up.</p>}
      <ul>
        {data.payments.map((p, index) => (
          <li key={index}>
            {names[p.from]} pays {names[p.to]} {formatMoney(p.amount_cents)}
          </li>
        ))}
      </ul>
 
      <AddMember groupId={groupId} onAdded={() => setReloadKey(reloadKey + 1)} />
 
      <RecordPayment
        groupId={groupId}
        members={data.balances}
        onDone={() => setReloadKey(reloadKey + 1)}
      />
 
      <AddExpense
        groupId={groupId}
        members={data.balances}
        onAdded={() => setReloadKey(reloadKey + 1)}
      />
 
      <h2>Expenses</h2>
      {data.expenses.length === 0 && <p>No expenses yet.</p>}
      <ul>
        {data.expenses.map((e) => (
          <li key={e.expense_id}>
            {e.description}: {formatMoney(Number(e.amount_cents))}, paid by {e.paid_by_name} on{' '}
            {e.expense_date}
          </li>
        ))}
      </ul>
    </div>
  );
}
 
export default GroupPage;
 