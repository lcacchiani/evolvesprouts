import type { Locale } from '@/content';
import type { DiscountRule } from '@/lib/discounts-data';

const MONTH_BY_SHORT_NAME: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

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

export function extractIsoDateFromPartDate(
  partDate: string,
  monthLabel: string,
): string {
  const normalizedPartDate = partDate.trim();
  const normalizedMonthLabel = monthLabel.trim();
  if (!normalizedPartDate || !normalizedMonthLabel) {
    return '';
  }

  const yearMatch = normalizedMonthLabel.match(/\b(\d{4})\b/);
  const partDateMatch = normalizedPartDate.match(/\b([A-Za-z]{3})\s+(\d{1,2})\b/);
  if (!yearMatch || !partDateMatch) {
    return '';
  }

  const year = Number.parseInt(yearMatch[1], 10);
  const monthNumber = MONTH_BY_SHORT_NAME[partDateMatch[1].toLowerCase()];
  const day = Number.parseInt(partDateMatch[2], 10);
  if (!monthNumber || !Number.isInteger(day) || day < 1 || day > 31) {
    return '';
  }

  return `${year.toString().padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
