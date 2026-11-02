export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}₹${(absolute / 100).toFixed(2)}`;
}

export function parseMoney(text) {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!match) return null;
  const rupees = Number(match[1]);
  const paise = Number((match[2] || '').padEnd(2, '0'));
  return rupees * 100 + paise;
}