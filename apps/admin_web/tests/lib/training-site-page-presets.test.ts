import { describe, expect, it } from 'vitest';

import { TRAINING_SITE_PAGE_PRESETS } from '@/lib/training-site-page-presets';
import { TRAINING_ROUTES } from '@shared-training/training-routes';

describe('TRAINING_SITE_PAGE_PRESETS', () => {
  it('uses only paths defined in shared TRAINING_ROUTES', () => {
    const allowed = new Set<string>(Object.values(TRAINING_ROUTES));
    for (const preset of TRAINING_SITE_PAGE_PRESETS) {
      expect(allowed.has(preset.pathInput)).toBe(true);
    }
  });

  it('lists each shared route at most once', () => {
    const inputs = TRAINING_SITE_PAGE_PRESETS.map((p) => p.pathInput);
    expect(new Set(inputs).size).toBe(inputs.length);
  });
});
