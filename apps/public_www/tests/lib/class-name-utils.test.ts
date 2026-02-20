import { describe, expect, it } from 'vitest';

import { mergeClassNames } from '@/lib/class-name-utils';

describe('mergeClassNames', () => {
  it('joins only truthy string values', () => {
    expect(
      mergeClassNames('base', '', null, undefined, false, 'accent', 'state'),
    ).toBe('base accent state');
  });

  it('returns an empty string when no class names are provided', () => {
    expect(mergeClassNames(undefined, null, false)).toBe('');
  });
});
