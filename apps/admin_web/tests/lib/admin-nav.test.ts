import { describe, expect, it } from 'vitest';

import { adminSectionKeyFromPathname } from '@/lib/admin-nav';

describe('adminSectionKeyFromPathname', () => {
  it('maps known dashboard paths to section keys', () => {
    expect(adminSectionKeyFromPathname('/sales')).toBe('sales');
    expect(adminSectionKeyFromPathname('/assets')).toBe('assets');
  });

  it('defaults to finance for unknown paths', () => {
    expect(adminSectionKeyFromPathname('/unknown')).toBe('finance');
  });
});
