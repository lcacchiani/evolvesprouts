import { describe, expect, it } from 'vitest';

import { parseEnrollmentIdList, parseLineTotalsOverridesJson } from '@/lib/billing-api';

describe('billing-api helpers', () => {
  it('parses enrollment ids from mixed separators', () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = '22222222-2222-2222-2222-222222222222';
    expect(parseEnrollmentIdList(`  ${a} , ${b} \n ${a} `)).toEqual([a, b, a]);
  });

  it('parses line total overrides JSON', () => {
    const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    expect(parseLineTotalsOverridesJson(`{"${id}": "10.5", "x": 3}`)).toEqual({
      [id]: '10.5',
      x: '3',
    });
  });

  it('returns null for invalid line totals JSON', () => {
    expect(parseLineTotalsOverridesJson('not json')).toBeNull();
    expect(parseLineTotalsOverridesJson('[]')).toBeNull();
  });
});
