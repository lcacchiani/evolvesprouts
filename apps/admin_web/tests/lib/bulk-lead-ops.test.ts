import { describe, expect, it, vi } from 'vitest';

import { formatBulkLeadFailureSummary, runBulkLeadOps } from '@/lib/bulk-lead-ops';

describe('runBulkLeadOps', () => {
  it('aggregates per-row success and failure results', async () => {
    const result = await runBulkLeadOps(['lead-1', 'lead-2', 'lead-3'], async (leadId) => {
      if (leadId === 'lead-2') {
        throw new Error('Permission denied');
      }
    });

    expect(result.succeeded).toEqual(['lead-1', 'lead-3']);
    expect(result.failed).toEqual([{ leadId: 'lead-2', reason: 'Permission denied' }]);
  });
});

describe('formatBulkLeadFailureSummary', () => {
  it('returns an empty string when there are no failures', () => {
    expect(formatBulkLeadFailureSummary([])).toBe('');
  });

  it('includes lead ids and reasons in the summary', () => {
    expect(
      formatBulkLeadFailureSummary([
        { leadId: 'lead-1', reason: 'Not found' },
        { leadId: 'lead-2', reason: 'Conflict' },
      ])
    ).toBe('2 lead(s) failed — lead-1: Not found; lead-2: Conflict');
  });
});
