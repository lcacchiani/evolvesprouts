import type { CSSProperties } from 'react';

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

export function toTransparentColor(hexColor: string): string {
  const normalizedHex = hexColor.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) {
    return 'rgba(255, 255, 255, 0)';
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0)`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createMaskIconStyle(
  iconPath: string,
  color: string,
): CSSProperties {
  return {
    backgroundColor: color,
    WebkitMaskImage: `url(${iconPath})`,
    maskImage: `url(${iconPath})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
  };
}

export function extractTimeRangeFromPartDate(partDate: string): string {
  const rawSegments = partDate.split('@');
  if (rawSegments.length < 2) {
    return '';
  }
  return rawSegments[1]?.trim() ?? '';
}
