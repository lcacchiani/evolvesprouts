import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackMetaPixelEvent } from '@/lib/meta-pixel';

describe('trackMetaPixelEvent', () => {
  afterEach(() => {
    delete (window as Record<string, unknown>).fbq;
  });

  it('calls fbq with event name when pixel is loaded', () => {
    const mockFbq = vi.fn();
    (window as Record<string, unknown>).fbq = mockFbq;

    trackMetaPixelEvent('Lead');

    expect(mockFbq).toHaveBeenCalledWith('track', 'Lead');
  });

  it('calls fbq with event name and params when provided', () => {
    const mockFbq = vi.fn();
    (window as Record<string, unknown>).fbq = mockFbq;

    trackMetaPixelEvent('Schedule', {
      content_name: 'my_best_auntie',
      value: 4800,
      currency: 'HKD',
    });

    expect(mockFbq).toHaveBeenCalledWith('track', 'Schedule', {
      content_name: 'my_best_auntie',
      value: 4800,
      currency: 'HKD',
    });
  });

  it('does not throw when fbq is not loaded', () => {
    delete (window as Record<string, unknown>).fbq;

    expect(() => trackMetaPixelEvent('Lead')).not.toThrow();
  });

  it('does not call fbq when it is not a function', () => {
    (window as Record<string, unknown>).fbq = 'not-a-function';

    expect(() => trackMetaPixelEvent('Contact')).not.toThrow();
  });

  it('fires Contact event without params', () => {
    const mockFbq = vi.fn();
    (window as Record<string, unknown>).fbq = mockFbq;

    trackMetaPixelEvent('Contact');

    expect(mockFbq).toHaveBeenCalledWith('track', 'Contact');
  });

  it('fires InitiateCheckout with content_name', () => {
    const mockFbq = vi.fn();
    (window as Record<string, unknown>).fbq = mockFbq;

    trackMetaPixelEvent('InitiateCheckout', { content_name: 'my_best_auntie' });

    expect(mockFbq).toHaveBeenCalledWith('track', 'InitiateCheckout', {
      content_name: 'my_best_auntie',
    });
  });
});
