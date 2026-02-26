import { describe, expect, it } from 'vitest';

import {
  getHrefKind,
  isExternalHref,
  isHttpHref,
  isSameRootDomainHttpHref,
  isUnsafeHref,
} from '@/lib/url-utils';

describe('url-utils', () => {
  it('detects HTTP and HTTPS links', () => {
    expect(isHttpHref('https://example.com')).toBe(true);
    expect(isHttpHref('http://example.com')).toBe(true);
    expect(isHttpHref('  HTTPS://example.com/path  ')).toBe(true);
  });

  it('does not treat non-HTTP links as HTTP', () => {
    expect(isHttpHref('/about-us')).toBe(false);
    expect(isHttpHref('#resources')).toBe(false);
    expect(isHttpHref('mailto:test@example.com')).toBe(false);
    expect(isHttpHref('tel:+85212345678')).toBe(false);
  });

  it('detects all external href variants used by the app', () => {
    expect(isExternalHref('https://example.com')).toBe(true);
    expect(isExternalHref('mailto:test@example.com')).toBe(true);
    expect(isExternalHref('tel:+85212345678')).toBe(true);
  });

  it('resolves href kinds using protocol buckets', () => {
    expect(getHrefKind('https://example.com')).toBe('http');
    expect(getHrefKind('mailto:test@example.com')).toBe('mailto');
    expect(getHrefKind('tel:+85212345678')).toBe('tel');
    expect(getHrefKind('#resources')).toBe('hash');
    expect(getHrefKind('/en/about-us')).toBe('internal');
  });

  it('flags unsafe href values and unsupported protocols', () => {
    expect(getHrefKind('javascript:alert(1)')).toBe('unsafe');
    expect(getHrefKind('data:text/html;base64,abc')).toBe('unsafe');
    expect(getHrefKind('//example.com/path')).toBe('unsafe');
    expect(getHrefKind('ftp://example.com')).toBe('unsafe');
    expect(getHrefKind('   ')).toBe('unsafe');
    expect(isUnsafeHref('javascript:alert(1)')).toBe(true);
  });

  it('keeps localized and anchor href values internal', () => {
    expect(isExternalHref('/en/about-us')).toBe(false);
    expect(isExternalHref('/zh-HK/events')).toBe(false);
    expect(isExternalHref('#resources')).toBe(false);
  });

  it('detects internal HTTP links across subdomains', () => {
    expect(
      isSameRootDomainHttpHref(
        'https://media.example.com/v1/assets/share/JJCS9GZJZzkT26WMgQyTWsTWk3ep1cr1',
        'www-staging.example.com',
      ),
    ).toBe(true);
    expect(
      isSameRootDomainHttpHref(
        'https://admin.example.com/dashboard',
        'www.example.com',
      ),
    ).toBe(true);
  });

  it('rejects HTTP links outside the current root domain', () => {
    expect(
      isSameRootDomainHttpHref(
        'https://cdn.another-example.com/download',
        'www.example.com',
      ),
    ).toBe(false);
    expect(
      isSameRootDomainHttpHref(
        'https://example.net/v1/assets/share/JJCS9GZJZzkT26WMgQyTWsTWk3ep1cr1',
        'www.example.com',
      ),
    ).toBe(false);
    expect(
      isSameRootDomainHttpHref(
        'mailto:hello@example.com',
        'www.example.com',
      ),
    ).toBe(false);
    expect(
      isSameRootDomainHttpHref(
        'https://media.example.com/path',
        '',
      ),
    ).toBe(false);
  });
});
