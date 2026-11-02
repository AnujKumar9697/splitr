export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}₹${(absolute / 100).toFixed(2)}`;
}