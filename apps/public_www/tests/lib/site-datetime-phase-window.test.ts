import { describe, expect, it } from 'vitest';

import { formatMyBestAuntiePhaseWindowDateLabels } from '@/lib/site-datetime';

describe('formatMyBestAuntiePhaseWindowDateLabels', () => {
  it('returns month and day labels without year, end 20 days after start (HK timezone)', () => {
    const result = formatMyBestAuntiePhaseWindowDateLabels(
      '2026-04-19T01:00:00Z',
      'en',
    );
    expect(result).not.toBeNull();
    expect(result?.startLabel).toBe('19 Apr');
    expect(result?.endLabel).toBe('09 May');
  });

  it('returns null for invalid input', () => {
    expect(formatMyBestAuntiePhaseWindowDateLabels('', 'en')).toBeNull();
    expect(formatMyBestAuntiePhaseWindowDateLabels('not-a-date', 'en')).toBeNull();
  });
});
