'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { AdminApiError, isAbortRequestError } from '@/lib/api-admin-client';
import {
  getMailchimpSyncStatus,
  runMailchimpOrphanCleanup,
  runMailchimpSyncBatch,
  type MailchimpOrphanRemovedSampleItem,
  type MailchimpSyncRunErrorSampleItem,
  type MailchimpSyncStatusResponse,
} from '@/lib/mailchimp-sync-api';

const MAX_SYNC_BATCHES = 1000;
const MAX_ORPHAN_BATCHES = 1000;

export const MAILCHIMP_PRODUCTION_GATE_MESSAGE =
  'Mailchimp bulk sync is only available in production. Counters above are read-only in this environment.';

const SESSION_EXPIRED_MESSAGE = 'Session expired — please sign in again.';

export type SyncRunTotals = {
  batches: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  wouldProcess: number;
  errorsSample: MailchimpSyncRunErrorSampleItem[];
};

export type OrphanRunTotals = {
  batches: number;
  scanned: number;
  kept: number;
  removed: number;
  failed: number;
  alreadyArchived: number;
  wouldRemove: number;
  removedSample: MailchimpOrphanRemovedSampleItem[];
};

export type RunState = 'idle' | 'running' | 'completed' | 'aborted' | 'errored';

const emptySyncTotals = (): SyncRunTotals => ({
  batches: 0,
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  wouldProcess: 0,
  errorsSample: [],
});

const emptyOrphanTotals = (): OrphanRunTotals => ({
  batches: 0,
  scanned: 0,
  kept: 0,
  removed: 0,
  failed: 0,
  alreadyArchived: 0,
  wouldRemove: 0,
  removedSample: [],
});

function mapAdminApiError(error: unknown): string {
  if (error instanceof AdminApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Request failed.';
}

export interface UseMailchimpSync {
  status: MailchimpSyncStatusResponse | null;
  statusLoading: boolean;
  statusError: string | null;
  refetchStatus: () => Promise<void>;
  productionGated: boolean;
  syncRun: { state: RunState; totals: SyncRunTotals; error: string | null };
  startSyncRun: (input: {
    tagName: string;
    maxContacts: number;
    onlyStatuses: ('pending' | 'failed')[];
    dryRun: boolean;
  }) => Promise<void>;
  abortSyncRun: () => void;
  orphanRun: { state: RunState; totals: OrphanRunTotals; error: string | null };
  startOrphanRun: (input: {
    maxMembers: number;
    mode: 'archive' | 'permanent';
    dryRun: boolean;
  }) => Promise<void>;
  abortOrphanRun: () => void;
}

export function useMailchimpSync(): UseMailchimpSync {
  const [status, setStatus] = useState<MailchimpSyncStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [productionGated, setProductionGated] = useState(false);

  const [syncRun, setSyncRun] = useState<{
    state: RunState;
    totals: SyncRunTotals;
    error: string | null;
  }>({
    state: 'idle',
    totals: emptySyncTotals(),
    error: null,
  });

  const [orphanRun, setOrphanRun] = useState<{
    state: RunState;
    totals: OrphanRunTotals;
    error: string | null;
  }>({
    state: 'idle',
    totals: emptyOrphanTotals(),
    error: null,
  });

  const syncAbortRef = useRef<AbortController | null>(null);
  const orphanAbortRef = useRef<AbortController | null>(null);

  const refetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await getMailchimpSyncStatus();
      setStatus(next);
    } catch (error) {
      setStatusError(mapAdminApiError(error));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetchStatus();
  }, [refetchStatus]);

  const abortSyncRun = useCallback(() => {
    syncAbortRef.current?.abort();
  }, []);

  const abortOrphanRun = useCallback(() => {
    orphanAbortRef.current?.abort();
  }, []);

  const startSyncRun = useCallback(
    async (input: {
      tagName: string;
      maxContacts: number;
      onlyStatuses: ('pending' | 'failed')[];
      dryRun: boolean;
    }) => {
      const controller = new AbortController();
      syncAbortRef.current = controller;
      const { signal } = controller;

      setSyncRun({
        state: 'running',
        totals: emptySyncTotals(),
        error: null,
      });
      const dryRun = input.dryRun;

      let cursor: string | null | undefined;
      let batches = 0;

      try {
        while (batches < MAX_SYNC_BATCHES) {
          const req: Parameters<typeof runMailchimpSyncBatch>[0] = {
            tag_name: input.tagName.trim(),
            max_contacts: input.maxContacts,
            only_statuses: input.onlyStatuses,
            dry_run: input.dryRun,
          };
          if (cursor != null && cursor !== '') {
            req.cursor = cursor;
          }
          const response = await runMailchimpSyncBatch(req, signal);

          batches += 1;
          setSyncRun((prev) => ({
            ...prev,
            state: 'running',
            totals: {
              batches: prev.totals.batches + 1,
              processed: prev.totals.processed + response.processed,
              succeeded: prev.totals.succeeded + response.succeeded,
              failed: prev.totals.failed + response.failed,
              skipped: prev.totals.skipped + response.skipped,
              wouldProcess: prev.totals.wouldProcess + (dryRun ? response.would_process : 0),
              errorsSample: response.errors_sample.slice(0, 5),
            },
          }));

          if (response.next_cursor === null) {
            setSyncRun((prev) => ({
              ...prev,
              state: 'completed',
              error: null,
            }));
            await refetchStatus();
            return;
          }

          cursor = response.next_cursor;
        }

        setSyncRun((prev) => ({
          ...prev,
          state: 'errored',
          error: 'Stopped: exceeded maximum batches per run.',
        }));
      } catch (error) {
        if (isAbortRequestError(error)) {
          setSyncRun((prev) => ({
            ...prev,
            state: 'aborted',
            error: null,
          }));
          return;
        }

        if (error instanceof AdminApiError) {
          if (error.statusCode === 401 || error.statusCode === 403) {
            setSyncRun((prev) => ({
              ...prev,
              state: 'errored',
              error: SESSION_EXPIRED_MESSAGE,
            }));
            return;
          }
          if (error.statusCode === 409) {
            setProductionGated(true);
            setSyncRun((prev) => ({
              ...prev,
              state: 'errored',
              error: MAILCHIMP_PRODUCTION_GATE_MESSAGE,
            }));
            return;
          }
        }

        setSyncRun((prev) => ({
          ...prev,
          state: 'errored',
          error: mapAdminApiError(error),
        }));
      }
    },
    [refetchStatus]
  );

  const startOrphanRun = useCallback(
    async (input: { maxMembers: number; mode: 'archive' | 'permanent'; dryRun: boolean }) => {
      const controller = new AbortController();
      orphanAbortRef.current = controller;
      const { signal } = controller;

      setOrphanRun({
        state: 'running',
        totals: emptyOrphanTotals(),
        error: null,
      });
      const dryRun = input.dryRun;

      let mailchimpOffset: number | null = 0;
      let batches = 0;

      try {
        while (batches < MAX_ORPHAN_BATCHES && mailchimpOffset !== null) {
          const response = await runMailchimpOrphanCleanup(
            {
              max_members: input.maxMembers,
              mailchimp_offset: mailchimpOffset,
              mode: input.mode,
              dry_run: input.dryRun,
            },
            signal
          );

          batches += 1;
          setOrphanRun((prev) => ({
            ...prev,
            state: 'running',
            totals: {
              batches: prev.totals.batches + 1,
              scanned: prev.totals.scanned + response.scanned,
              kept: prev.totals.kept + response.kept,
              removed: prev.totals.removed + response.removed,
              failed: prev.totals.failed + response.failed,
              alreadyArchived: prev.totals.alreadyArchived + response.already_archived,
              wouldRemove: prev.totals.wouldRemove + (dryRun ? response.would_remove : 0),
              removedSample: response.removed_sample.slice(0, 5),
            },
          }));

          if (response.next_offset === null) {
            setOrphanRun((prev) => ({
              ...prev,
              state: 'completed',
              error: null,
            }));
            await refetchStatus();
            return;
          }

          mailchimpOffset = response.next_offset;
        }

        if (mailchimpOffset !== null) {
          setOrphanRun((prev) => ({
            ...prev,
            state: 'errored',
            error: 'Stopped: exceeded maximum batches per run.',
          }));
        }
      } catch (error) {
        if (isAbortRequestError(error)) {
          setOrphanRun((prev) => ({
            ...prev,
            state: 'aborted',
            error: null,
          }));
          return;
        }

        if (error instanceof AdminApiError) {
          if (error.statusCode === 401 || error.statusCode === 403) {
            setOrphanRun((prev) => ({
              ...prev,
              state: 'errored',
              error: SESSION_EXPIRED_MESSAGE,
            }));
            return;
          }
          if (error.statusCode === 409) {
            setProductionGated(true);
            setOrphanRun((prev) => ({
              ...prev,
              state: 'errored',
              error: MAILCHIMP_PRODUCTION_GATE_MESSAGE,
            }));
            return;
          }
        }

        setOrphanRun((prev) => ({
          ...prev,
          state: 'errored',
          error: mapAdminApiError(error),
        }));
      }
    },
    [refetchStatus]
  );

  return {
    status,
    statusLoading,
    statusError,
    refetchStatus,
    productionGated,
    syncRun: {
      state: syncRun.state,
      totals: syncRun.totals,
      error: syncRun.error,
    },
    startSyncRun,
    abortSyncRun,
    orphanRun: {
      state: orphanRun.state,
      totals: orphanRun.totals,
      error: orphanRun.error,
    },
    startOrphanRun,
    abortOrphanRun,
  };
}
