import { describe, expect, it } from 'vitest';

import {
  formatPaymentMethodLabel,
  formatTruncatedId,
} from '@/components/admin/finance/client-invoices-format-helpers';

describe('client-invoices-format-helpers', () => {
  describe('formatTruncatedId', () => {
    it('maps nullish and empty to em dash', () => {
      expect(formatTruncatedId(null)).toBe('—');
      expect(formatTruncatedId(undefined)).toBe('—');
      expect(formatTruncatedId('')).toBe('—');
    });

    it('returns short ids unchanged up to length 12', () => {
      expect(formatTruncatedId('abc')).toBe('abc');
      expect(formatTruncatedId('123456789012')).toBe('123456789012');
    });

    it('truncates ids longer than 12 characters', () => {
      expect(formatTruncatedId('1234567890123')).toBe('12345678…');
    });
  });

  describe('formatPaymentMethodLabel', () => {
    it('replaces Fps with FPS at word boundaries', () => {
      expect(formatPaymentMethodLabel('fps_transfer')).toContain('FPS');
      expect(formatPaymentMethodLabel('prefix_fps_suffix')).toContain('FPS');
      expect(formatPaymentMethodLabel('fps')).toContain('FPS');
    });

    it('leaves non-Fps strings unchanged aside from enum formatting', () => {
      expect(formatPaymentMethodLabel('bank_transfer')).toBe('Bank Transfer');
    });
  });
});
