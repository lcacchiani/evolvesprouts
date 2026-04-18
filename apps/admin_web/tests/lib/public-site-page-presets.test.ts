import { describe, expect, it } from 'vitest';

import { PUBLIC_SITE_PAGE_PRESETS } from '@/lib/public-site-page-presets';
import { PUBLIC_WWW_ROUTES } from '@shared-public-www/public-www-routes';

describe('PUBLIC_SITE_PAGE_PRESETS', () => {
  it('uses only paths defined in shared PUBLIC_WWW_ROUTES', () => {
    const allowed = new Set<string>(Object.values(PUBLIC_WWW_ROUTES));
    for (const preset of PUBLIC_SITE_PAGE_PRESETS) {
      expect(allowed.has(preset.pathInput)).toBe(true);
    }
  });

  it('lists each shared route at most once', () => {
    const inputs = PUBLIC_SITE_PAGE_PRESETS.map((p) => p.pathInput);
    expect(new Set(inputs).size).toBe(inputs.length);
  });
});
