const HKD_CURRENCY_FORMATTER = new Intl.NumberFormat('en-HK', {
  style: 'currency',
  currency: 'HKD',
  maximumFractionDigits: 0,
});

export function formatCurrencyHkd(value: number): string {
  return HKD_CURRENCY_FORMATTER.format(value);
}
