export function formatMoney(amount, currency, locale) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'TWD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency || ''}`.trim();
  }
}
