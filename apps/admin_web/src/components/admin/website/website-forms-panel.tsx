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
  clearAdminFormAnswers,
  exportAdminFormAnswersCsv,
  formatFormAnswerValue,
  listAdminFormAnswers,
  listAdminForms,
  type AdminFormAnswerRow,
  type AdminFormSummary,
} from '@/lib/forms-api';
import { formatDate } from '@/lib/format';

export function WebsiteFormsPanel() {
  const [forms, setForms] = useState<AdminFormSummary[]>([]);
  const [selectedFormSlug, setSelectedFormSlug] = useState('');
  const [answers, setAnswers] = useState<AdminFormAnswerRow[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [formsError, setFormsError] = useState('');
  const [answersError, setAnswersError] = useState('');
  const [actionError, setActionError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const selectedForm = useMemo(
    () => forms.find((form) => form.formSlug === selectedFormSlug) ?? null,
    [forms, selectedFormSlug]
  );

  const loadForms = useCallback(async (signal?: AbortSignal) => {
    setFormsLoading(true);
    setFormsError('');
    try {
      const items = await listAdminForms(signal);
      setForms(items);
      setSelectedFormSlug((current) => {
        if (current && items.some((item) => item.formSlug === current)) {
          return current;
        }
        return items[0]?.formSlug ?? '';
      });
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setFormsError(toErrorMessage(error, 'Failed to load forms.'));
    } finally {
      if (!signal?.aborted) {
        setFormsLoading(false);
      }
    }
  }, []);

  const loadAnswers = useCallback(async (formSlug: string, signal?: AbortSignal) => {
    if (!formSlug) {
      setAnswers([]);
      setAnswersError('');
      return;
    }
    setAnswersLoading(true);
    setAnswersError('');
    try {
      const items = await listAdminFormAnswers(formSlug, signal);
      setAnswers(items);
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setAnswersError(toErrorMessage(error, 'Failed to load form answers.'));
    } finally {
      if (!signal?.aborted) {
        setAnswersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadForms(controller.signal);
    return () => controller.abort();
  }, [loadForms]);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnswers(selectedFormSlug, controller.signal);
    return () => controller.abort();
  }, [loadAnswers, selectedFormSlug]);

  const handleExport = async () => {
    if (!selectedFormSlug) {
      return;
    }
    setActionError('');
    setExporting(true);
    try {
      const blob = await exportAdminFormAnswersCsv(selectedFormSlug);
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `form-${selectedFormSlug}-answers-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setActionError(toErrorMessage(error, 'Failed to export form answers.'));
    } finally {
      setExporting(false);
    }
  };

  const handleClearConfirm = async () => {
    if (!selectedFormSlug) {
      return;
    }
    setActionError('');
    setClearing(true);
    try {
      await clearAdminFormAnswers(selectedFormSlug);
      setClearDialogOpen(false);
      await Promise.all([loadForms(), loadAnswers(selectedFormSlug)]);
    } catch (error) {
      setActionError(toErrorMessage(error, 'Failed to clear form answers.'));
    } finally {
      setClearing(false);
    }
  };

  const toolbar = (
    <div className='mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
      <div className='min-w-[240px] max-w-md flex-1'>
        <Label htmlFor='website-forms-select'>Form</Label>
        <Select
          id='website-forms-select'
          value={selectedFormSlug}
          onChange={(event) => setSelectedFormSlug(event.target.value)}
          disabled={formsLoading || forms.length === 0}
        >
          {forms.length === 0 ? (
            <option value=''>No forms found</option>
          ) : (
            forms.map((form) => (
              <option key={form.formSlug} value={form.formSlug}>
                {form.formSlug} ({form.answerCount} answers)
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
          disabled={!selectedFormSlug || exporting || answersLoading}
        >
          {exporting ? 'Exporting…' : 'Export answers'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => setClearDialogOpen(true)}
          disabled={!selectedFormSlug || clearing || answersLoading || answers.length === 0}
        >
          Clear answers
        </Button>
      </div>
    </div>
  );

  return (
    <div className='space-y-4'>
      {formsError ? <AdminPageErrorBanner title='Forms' message={formsError} /> : null}
      {actionError ? <AdminPageErrorBanner title='Form action' message={actionError} /> : null}

      <PaginatedTableCard
        title='Form answers'
        description={
          selectedForm
            ? `${selectedForm.answerCount} stored answer rows for ${selectedForm.formSlug}.`
            : 'Choose a form to view stored answers from DynamoDB.'
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
                  {selectedFormSlug
                    ? 'No answers stored for this form yet.'
                    : 'Select a form to load answers.'}
                </AdminDataTableCell>
              </tr>
            ) : (
              answers.map((row) => (
                <tr key={`${row.sessionId}-${row.questionId}`}>
                  <AdminDataTableCell className='font-mono text-xs'>{row.sessionId}</AdminDataTableCell>
                  <AdminDataTableCell>{row.questionId}</AdminDataTableCell>
                  <AdminDataTableCell>{row.questionType}</AdminDataTableCell>
                  <AdminDataTableCell>{formatFormAnswerValue(row)}</AdminDataTableCell>
                  <AdminDataTableCell>{formatDate(row.updatedAt)}</AdminDataTableCell>
                </tr>
              ))
            )}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>

      <ConfirmDialog
        open={clearDialogOpen}
        title='Clear form answers'
        description={
          selectedFormSlug
            ? `Permanently delete all ${answers.length} stored answer rows for "${selectedFormSlug}"? This cannot be undone.`
            : 'Permanently delete all stored answer rows for this form? This cannot be undone.'
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
