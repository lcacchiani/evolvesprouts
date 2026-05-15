import { describe, expect, it } from 'vitest';

import { adminSectionKeyFromPathname } from '@/lib/admin-nav';

describe('adminSectionKeyFromPathname', () => {
  it('maps dashboard paths to the dashboard section key', () => {
    expect(adminSectionKeyFromPathname('/dashboard')).toBe('dashboard');
    expect(adminSectionKeyFromPathname('/dashboard/')).toBe('dashboard');
  });

  it('maps known dashboard paths to section keys', () => {
    expect(adminSectionKeyFromPathname('/sales')).toBe('sales');
    expect(adminSectionKeyFromPathname('/assets')).toBe('assets');
    expect(adminSectionKeyFromPathname('/audit')).toBe('audit');
    expect(adminSectionKeyFromPathname('/calendar')).toBe('calendar');
    expect(adminSectionKeyFromPathname('/contacts')).toBe('contacts');
    expect(adminSectionKeyFromPathname('/finance')).toBe('finance');
    expect(adminSectionKeyFromPathname('/services')).toBe('services');
    expect(adminSectionKeyFromPathname('/tags')).toBe('tags');
    expect(adminSectionKeyFromPathname('/website')).toBe('website');
  });

  it('matches paths served with a trailing slash (next.config trailingSlash: true)', () => {
    expect(adminSectionKeyFromPathname('/sales/')).toBe('sales');
    expect(adminSectionKeyFromPathname('/assets/')).toBe('assets');
    expect(adminSectionKeyFromPathname('/audit/')).toBe('audit');
    expect(adminSectionKeyFromPathname('/calendar/')).toBe('calendar');
    expect(adminSectionKeyFromPathname('/contacts/')).toBe('contacts');
    expect(adminSectionKeyFromPathname('/finance/')).toBe('finance');
    expect(adminSectionKeyFromPathname('/services/')).toBe('services');
    expect(adminSectionKeyFromPathname('/tags/')).toBe('tags');
    expect(adminSectionKeyFromPathname('/website/')).toBe('website');
  });

  it('treats paths under /dashboard as the dashboard section, including nested paths', () => {
    expect(adminSectionKeyFromPathname('/dashboard/finance')).toBe('dashboard');
    expect(adminSectionKeyFromPathname('/dashboard/widgets')).toBe('dashboard');
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
