import type { Locale } from '@/content';
import type { DiscountRule } from '@/lib/discounts-data';

export function applyDiscount(
  basePrice: number,
  rule: DiscountRule | null,
): number {
  if (!rule) {
    return basePrice;
  }

  if (rule.type === 'percent') {
    return Math.max(0, Math.round(basePrice * (1 - rule.value / 100)));
  }

  return Math.max(0, basePrice - rule.value);
}

export function resolveLocalizedDate(locale: Locale): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return dateFormatter.format(new Date());
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function extractTimeRangeFromPartDate(partDate: string): string {
  const rawSegments = partDate.split('@');
  if (rawSegments.length < 2) {
    return '';
  }
  return rawSegments[1]?.trim() ?? '';
}
