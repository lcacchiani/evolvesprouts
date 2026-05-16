import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApiError } from '@/lib/api-admin-client';

const { getMailchimpSyncStatus, runMailchimpSyncBatch, runMailchimpOrphanCleanup } = vi.hoisted(() => ({
  getMailchimpSyncStatus: vi.fn(),
  runMailchimpSyncBatch: vi.fn(),
  runMailchimpOrphanCleanup: vi.fn(),
}));

vi.mock('@/lib/mailchimp-sync-api', () => ({
  getMailchimpSyncStatus,
  runMailchimpSyncBatch,
  runMailchimpOrphanCleanup,
}));

import { useMailchimpSync } from '@/hooks/use-mailchimp-sync';

const defaultStatus = {
  counts_by_status: { pending: 0, synced: 0, failed: 0, unsubscribed: 0 },
  archived_with_mailchimp_record: 0,
  last_run_summary: null,
};

function baseSyncResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    next_cursor: null,
    errors_sample: [],
    dry_run: false,
    would_process: 0,
    ...overrides,
  };
}

describe('useMailchimpSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMailchimpSyncStatus.mockResolvedValue(defaultStatus);
    runMailchimpSyncBatch.mockResolvedValue(baseSyncResponse());
    runMailchimpOrphanCleanup.mockResolvedValue({
      scanned: 0,
      kept: 0,
      removed: 0,
      failed: 0,
      next_offset: null,
      removed_sample: [],
      dry_run: false,
      would_remove: 0,
      already_archived: 0,
    });
  });

  it('aborts in-flight sync on unmount so a second batch is not requested', async () => {
    let resolveBatch: (v: unknown) => void = () => {};
    const pending = new Promise((r) => {
      resolveBatch = r;
    });
    runMailchimpSyncBatch.mockReturnValueOnce(pending as Promise<unknown>);

    const { result, unmount } = renderHook(() => useMailchimpSync());

    await waitFor(() => expect(getMailchimpSyncStatus).toHaveBeenCalled());

    await act(async () => {
      void result.current.startSyncRun({
        tagName: 'crm-bulk-sync',
        maxContacts: 100,
        onlyStatuses: ['pending', 'failed'],
        dryRun: true,
      });
    });

    await waitFor(() => expect(runMailchimpSyncBatch).toHaveBeenCalledTimes(1));

    unmount();

    await act(async () => {
      resolveBatch(
        baseSyncResponse({
          next_cursor: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        })
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(runMailchimpSyncBatch).toHaveBeenCalledTimes(1);
  });

  it('clears productionGated after a successful batch following a 409', async () => {
    runMailchimpSyncBatch
      .mockRejectedValueOnce(
        new AdminApiError({
          statusCode: 409,
          payload: { detail: 'no' },
          message: 'conflict',
        })
      )
      .mockResolvedValueOnce(baseSyncResponse());

    const { result } = renderHook(() => useMailchimpSync());
    await waitFor(() => expect(getMailchimpSyncStatus).toHaveBeenCalled());

    await act(async () => {
      await result.current.startSyncRun({
        tagName: 'crm-bulk-sync',
        maxContacts: 100,
        onlyStatuses: ['pending', 'failed'],
        dryRun: true,
      });
    });

    await waitFor(() => expect(result.current.productionGated).toBe(true));

    await act(async () => {
      await result.current.startSyncRun({
        tagName: 'crm-bulk-sync',
        maxContacts: 100,
        onlyStatuses: ['pending', 'failed'],
        dryRun: true,
      });
    });

    await waitFor(() => expect(result.current.productionGated).toBe(false));
  });
});
