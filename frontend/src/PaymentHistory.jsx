import { useEffect, useState } from 'react';
import { api } from './api';
import { formatMoney } from './money';
 
function PaymentHistory() {
  const me = JSON.parse(localStorage.getItem('user'));
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
 
  useEffect(() => {
    api('/payments')
      .then((result) => setPayments(result.payments))
      .catch((err) => setError(err.message));
  }, []);
 
  if (error) {
    return <p style={{ color: 'crimson' }}>{error}</p>;
  }
  if (!payments) {
    return <p>Loading payments...</p>;
  }
 
  return (
    <div>
      <h3>Payment history</h3>
      {payments.length === 0 && <p>No payments yet.</p>}
      <ul>
        {payments.map((p) => {
          const iPaid = String(p.paid_by) === String(me.user_id);
          const amount = formatMoney(Number(p.amount_cents));
          return (
            <li key={p.settlement_id}>
              {iPaid
                ? `You paid ${p.paid_to_name} ${amount}`
                : `${p.paid_by_name} paid you ${amount}`}{' '}
              in {p.group_name} on {p.settled_on}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
 
export default PaymentHistory;
 