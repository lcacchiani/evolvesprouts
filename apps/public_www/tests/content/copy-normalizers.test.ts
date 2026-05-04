import { describe, expect, it } from 'vitest';

import { resolveFreeIntroSessionCopy } from '@/content/copy-normalizers';
import type { FreeIntroSessionContent } from '@/content';

describe('copy-normalizers freeIntroSession', () => {
  it('reads title and description from content record', () => {
    const content = {
      title: 'T',
      eventPageTitle: 'E',
      description: 'D',
      ctaLabel: 'C',
      ctaHref: '/x',
      phoneNumber: '',
      prefillMessage: '',
    } satisfies FreeIntroSessionContent;

    expect(resolveFreeIntroSessionCopy(content)).toEqual({
      title: 'T',
      description: 'D',
    });
  });
});
