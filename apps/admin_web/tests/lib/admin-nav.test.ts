import { describe, expect, it } from 'vitest';

import { adminSectionKeyFromPathname } from '@/lib/admin-nav';

describe('adminSectionKeyFromPathname', () => {
  it('maps known dashboard paths to section keys', () => {
    expect(adminSectionKeyFromPathname('/sales')).toBe('sales');
    expect(adminSectionKeyFromPathname('/assets')).toBe('assets');
    expect(adminSectionKeyFromPathname('/contacts')).toBe('contacts');
    expect(adminSectionKeyFromPathname('/finance')).toBe('finance');
    expect(adminSectionKeyFromPathname('/services')).toBe('services');
    expect(adminSectionKeyFromPathname('/website')).toBe('website');
  });

  it('matches paths served with a trailing slash (next.config trailingSlash: true)', () => {
    expect(adminSectionKeyFromPathname('/sales/')).toBe('sales');
    expect(adminSectionKeyFromPathname('/assets/')).toBe('assets');
    expect(adminSectionKeyFromPathname('/contacts/')).toBe('contacts');
    expect(adminSectionKeyFromPathname('/finance/')).toBe('finance');
    expect(adminSectionKeyFromPathname('/services/')).toBe('services');
    expect(adminSectionKeyFromPathname('/website/')).toBe('website');
  });

  it('matches nested paths under a section as that section', () => {
    expect(adminSectionKeyFromPathname('/sales/leads/abc-123')).toBe('sales');
    expect(adminSectionKeyFromPathname('/services/instances/')).toBe(
      'services'
    );
    expect(adminSectionKeyFromPathname('/finance/expenses/')).toBe('finance');
  });

  it('defaults to finance for unknown paths', () => {
    expect(adminSectionKeyFromPathname('/unknown')).toBe('finance');
    expect(adminSectionKeyFromPathname('/')).toBe('finance');
    expect(adminSectionKeyFromPathname('')).toBe('finance');
    expect(adminSectionKeyFromPathname(null)).toBe('finance');
    expect(adminSectionKeyFromPathname(undefined)).toBe('finance');
  });

  it('does not match a path that merely starts with a section name', () => {
    expect(adminSectionKeyFromPathname('/salesish')).toBe('finance');
    expect(adminSectionKeyFromPathname('/assets-archive')).toBe('finance');
  });
});
