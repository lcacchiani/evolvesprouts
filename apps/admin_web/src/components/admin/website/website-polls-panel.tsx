'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { AdminPageErrorBanner } from '@/components/admin/admin-page-error-banner';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHead,
  AdminDataTableHeadCell,
} from '@/components/ui/admin-data-table';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { toErrorMessage } from '@/hooks/hook-errors';
import {
  clearAdminPollAnswers,
  exportAdminPollAnswersCsv,
  formatPollAnswerValue,
  listAdminPollAnswers,
  listAdminPolls,
  type AdminPollAnswerRow,
  type AdminPollSummary,
} from '@/lib/polls-api';
import { formatDate } from '@/lib/format';

export function WebsitePollsPanel() {
  const [polls, setPolls] = useState<AdminPollSummary[]>([]);
  const [selectedPollSlug, setSelectedPollSlug] = useState('');
  const [answers, setAnswers] = useState<AdminPollAnswerRow[]>([]);
  const [pollsLoading, setPollsLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [pollsError, setPollsError] = useState('');
  const [answersError, setAnswersError] = useState('');
  const [actionError, setActionError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.pollSlug === selectedPollSlug) ?? null,
    [polls, selectedPollSlug]
  );

  const loadPolls = useCallback(async (signal?: AbortSignal) => {
    setPollsLoading(true);
    setPollsError('');
    try {
      const items = await listAdminPolls(signal);
      setPolls(items);
      setSelectedPollSlug((current) => {
        if (current && items.some((item) => item.pollSlug === current)) {
          return current;
        }
        return items[0]?.pollSlug ?? '';
      });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setPollsError(toErrorMessage(error, 'Failed to load polls.'));
    } finally {
      if (!signal?.aborted) {
        setPollsLoading(false);
      }
    }
  }, []);

  const loadAnswers = useCallback(async (pollSlug: string, signal?: AbortSignal) => {
    if (!pollSlug) {
      setAnswers([]);
      setAnswersError('');
      return;
    }
    setAnswersLoading(true);
    setAnswersError('');
    try {
      const items = await listAdminPollAnswers(pollSlug, signal);
      setAnswers(items);
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setAnswersError(toErrorMessage(error, 'Failed to load poll answers.'));
    } finally {
      if (!signal?.aborted) {
        setAnswersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadPolls(controller.signal);
    return () => controller.abort();
  }, [loadPolls]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnswers(selectedPollSlug, controller.signal);
    return () => controller.abort();
  }, [loadAnswers, selectedPollSlug]);

  const handleExport = async () => {
    if (!selectedPollSlug) {
      return;
    }
    setActionError('');
    setExporting(true);
    try {
      const blob = await exportAdminPollAnswersCsv(selectedPollSlug);
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `poll-${selectedPollSlug}-answers-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setActionError(toErrorMessage(error, 'Failed to export poll answers.'));
    } finally {
      setExporting(false);
    }
  };

  const handleClearConfirm = async () => {
    if (!selectedPollSlug) {
      return;
    }
    setActionError('');
    setClearing(true);
    try {
      await clearAdminPollAnswers(selectedPollSlug);
      setClearDialogOpen(false);
      await Promise.all([loadPolls(), loadAnswers(selectedPollSlug)]);
    } catch (error) {
      setActionError(toErrorMessage(error, 'Failed to clear poll answers.'));
    } finally {
      setClearing(false);
    }
  };

  const toolbar = (
    <div className='mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
      <div className='min-w-[240px] max-w-md flex-1'>
        <Label htmlFor='website-polls-select'>Poll</Label>
        <Select
          id='website-polls-select'
          value={selectedPollSlug}
          onChange={(event) => setSelectedPollSlug(event.target.value)}
          disabled={pollsLoading || polls.length === 0}
        >
          {polls.length === 0 ? (
            <option value=''>No polls found</option>
          ) : (
            polls.map((poll) => (
              <option key={poll.pollSlug} value={poll.pollSlug}>
                {poll.pollSlug} ({poll.answerCount} answers)
              </option>
            ))
          )}
        </Select>
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={() => void handleExport()}
          disabled={!selectedPollSlug || exporting || answersLoading}
        >
          {exporting ? 'Exporting…' : 'Export answers'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => setClearDialogOpen(true)}
          disabled={!selectedPollSlug || clearing || answersLoading || answers.length === 0}
        >
          Clear answers
        </Button>
      </div>
    </div>
  );

  return (
    <div className='space-y-4'>
      {pollsError ? <AdminPageErrorBanner title='Polls' message={pollsError} /> : null}
      {actionError ? <AdminPageErrorBanner title='Poll action' message={actionError} /> : null}

      <PaginatedTableCard
        title='Poll answers'
        description={
          selectedPoll
            ? `${selectedPoll.answerCount} stored answer rows for ${selectedPoll.pollSlug}.`
            : 'Choose a poll to view stored answers from DynamoDB.'
        }
        isLoading={answersLoading}
        isLoadingMore={false}
        hasMore={false}
        error={answersError}
        loadingLabel='Loading answers…'
        onLoadMore={() => {}}
        toolbar={toolbar}
      >
        <AdminDataTable tableClassName='min-w-[960px]'>
          <AdminDataTableHead>
            <tr>
              <AdminDataTableHeadCell>Session</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Question</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Type</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Answer</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Updated</AdminDataTableHeadCell>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {!answersLoading && answers.length === 0 ? (
              <tr>
                <AdminDataTableCell colSpan={5} className='text-slate-500'>
                  {selectedPollSlug
                    ? 'No answers stored for this poll yet.'
                    : 'Select a poll to load answers.'}
                </AdminDataTableCell>
              </tr>
            ) : (
              answers.map((row) => (
                <tr key={`${row.sessionId}-${row.questionId}`}>
                  <AdminDataTableCell className='font-mono text-xs'>{row.sessionId}</AdminDataTableCell>
                  <AdminDataTableCell>{row.questionId}</AdminDataTableCell>
                  <AdminDataTableCell>{row.questionType}</AdminDataTableCell>
                  <AdminDataTableCell>{formatPollAnswerValue(row)}</AdminDataTableCell>
                  <AdminDataTableCell>{formatDate(row.updatedAt)}</AdminDataTableCell>
                </tr>
              ))
            )}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>

      <ConfirmDialog
        open={clearDialogOpen}
        title='Clear poll answers'
        description={
          selectedPollSlug
            ? `Permanently delete all ${answers.length} stored answer rows for "${selectedPollSlug}"? This cannot be undone.`
            : 'Permanently delete all stored answer rows for this poll? This cannot be undone.'
        }
        confirmLabel={clearing ? 'Clearing…' : 'Clear answers'}
        cancelLabel='Cancel'
        variant='danger'
        confirmDisabled={clearing}
        onConfirm={() => void handleClearConfirm()}
        onCancel={() => {
          if (!clearing) {
            setClearDialogOpen(false);
          }
        }}
      />
    </div>
  );
}
