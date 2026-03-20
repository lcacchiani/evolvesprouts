import type { Locale } from '@/content';
import type { DiscountRule } from '@/lib/discounts-data';
import { formatTodayLongDate } from '@/lib/site-datetime';

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
  return formatTodayLongDate(locale);
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
  const monthDayMatch = normalizedPartDate.match(/\b([A-Za-z]{3})\s+(\d{1,2})\b/);
  const dayMonthMatch = normalizedPartDate.match(/\b(\d{1,2})\s+([A-Za-z]{3})\b/);
  if (!yearMatch || (!monthDayMatch && !dayMonthMatch)) {
    return '';
  }

  const year = Number.parseInt(yearMatch[1], 10);
  let monthNumber: number | undefined;
  let day: number | undefined;
  if (monthDayMatch) {
    monthNumber = MONTH_BY_SHORT_NAME[monthDayMatch[1].toLowerCase()];
    day = Number.parseInt(monthDayMatch[2], 10);
  } else if (dayMonthMatch) {
    day = Number.parseInt(dayMonthMatch[1], 10);
    monthNumber = MONTH_BY_SHORT_NAME[dayMonthMatch[2].toLowerCase()];
  }
  if (!monthNumber || day === undefined || !Number.isInteger(day) || day < 1 || day > 31) {
    return '';
  }

  return `${year.toString().padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
