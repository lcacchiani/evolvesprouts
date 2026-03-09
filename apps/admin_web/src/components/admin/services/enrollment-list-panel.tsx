'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatDate, formatEnumLabel } from '@/lib/format';

import type { components } from '@/types/generated/admin-api.generated';
import type { Enrollment } from '@/types/services';
import { ENROLLMENT_STATUSES } from '@/types/services';

type ApiSchemas = components['schemas'];

export interface EnrollmentListPanelProps {
  enrollments: Enrollment[];
  canCreate: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string;
  isMutating: boolean;
  onLoadMore: () => Promise<void> | void;
  onCreate: (payload: ApiSchemas['CreateEnrollmentRequest']) => Promise<void> | void;
  onUpdate: (
    enrollmentId: string,
    payload: ApiSchemas['UpdateEnrollmentRequest']
  ) => Promise<void> | void;
  onDelete: (enrollmentId: string) => Promise<void> | void;
}

export function EnrollmentListPanel({
  enrollments,
  canCreate,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  isMutating,
  onLoadMore,
  onCreate,
  onUpdate,
  onDelete,
}: EnrollmentListPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null);
  const [contactId, setContactId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [status, setStatus] = useState<ApiSchemas['EnrollmentStatus']>('registered');
  const [amountPaid, setAmountPaid] = useState('');
  const [currency, setCurrency] = useState('HKD');
  const [notes, setNotes] = useState('');

  const selectedEnrollment = useMemo(
    () => enrollments.find((entry) => entry.id === selectedEnrollmentId) ?? null,
    [enrollments, selectedEnrollmentId]
  );
  const isEditMode = Boolean(selectedEnrollment);

  const resetCreateForm = () => {
    setSelectedEnrollmentId(null);
    setContactId('');
    setFamilyId('');
    setOrganizationId('');
    setStatus('registered');
    setAmountPaid('');
    setCurrency('HKD');
    setNotes('');
  };

  const buildCreatePayload = (): ApiSchemas['CreateEnrollmentRequest'] => ({
    contact_id: contactId.trim() || null,
    family_id: familyId.trim() || null,
    organization_id: organizationId.trim() || null,
    status,
    amount_paid: amountPaid.trim() || null,
    currency: currency.trim() || null,
    notes: notes.trim() || null,
  });

  const buildUpdatePayload = (): ApiSchemas['UpdateEnrollmentRequest'] => ({
    status,
    amount_paid: amountPaid.trim() || null,
    currency: currency.trim() || null,
    notes: notes.trim() || null,
  });

  const handleSave = async () => {
    try {
      if (!isEditMode) {
        await onCreate(buildCreatePayload());
        resetCreateForm();
        return;
      }
      if (!selectedEnrollment) {
        return;
      }
      await onUpdate(selectedEnrollment.id, buildUpdatePayload());
    } catch {
      // Keep inline form state visible to let users retry.
    }
  };

  const applyEnrollmentSelection = (enrollment: Enrollment) => {
    setSelectedEnrollmentId(enrollment.id);
    setContactId(enrollment.contactId ?? '');
    setFamilyId(enrollment.familyId ?? '');
    setOrganizationId(enrollment.organizationId ?? '');
    setStatus(enrollment.status);
    setAmountPaid(enrollment.amountPaid ?? '');
    setCurrency(enrollment.currency ?? 'HKD');
    setNotes(enrollment.notes ?? '');
  };

  const handleDeleteEnrollment = async (enrollment: Enrollment) => {
    const confirmed = await requestConfirm({
      title: 'Delete enrollment',
      description: `Delete enrollment "${enrollment.id}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDelete(enrollment.id);
    if (selectedEnrollmentId === enrollment.id) {
      resetCreateForm();
    }
  };

  return (
    <>
      <Card
        title='Enrollments'
        description='Add or update an enrollment using the same fields below.'
        className='space-y-3'
      >
        {!canCreate ? (
          <p className='text-xs text-slate-500'>
            Select a service and instance before creating or editing enrollments.
          </p>
        ) : null}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <div>
            <Label htmlFor='enrollment-contact-id'>Contact ID</Label>
            <Input
              id='enrollment-contact-id'
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              disabled={isEditMode}
            />
          </div>
          <div>
            <Label htmlFor='enrollment-family-id'>Family ID</Label>
            <Input
              id='enrollment-family-id'
              value={familyId}
              onChange={(event) => setFamilyId(event.target.value)}
              disabled={isEditMode}
            />
          </div>
          <div>
            <Label htmlFor='enrollment-organization-id'>Organization ID</Label>
            <Input
              id='enrollment-organization-id'
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              disabled={isEditMode}
            />
          </div>
        </div>
        <p className='text-xs text-slate-500'>
          Contact, family, and organization IDs are set during creation and are read-only when editing.
        </p>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <div>
            <Label htmlFor='enrollment-status'>Status</Label>
            <Select
              id='enrollment-status'
              value={status}
              onChange={(event) => setStatus(event.target.value as ApiSchemas['EnrollmentStatus'])}
            >
              {ENROLLMENT_STATUSES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='enrollment-amount'>Amount paid</Label>
            <Input id='enrollment-amount' value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='enrollment-currency'>Currency</Label>
            <Input id='enrollment-currency' value={currency} onChange={(event) => setCurrency(event.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor='enrollment-notes'>Notes</Label>
          <Textarea id='enrollment-notes' value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </div>
        <div className='flex justify-start gap-2'>
          {isEditMode ? (
            <Button
              type='button'
              disabled={isMutating || !selectedEnrollment}
              onClick={() => void handleSave()}
            >
              {isMutating ? 'Updating...' : 'Update Enrollment'}
            </Button>
          ) : (
            <Button
              type='button'
              disabled={!canCreate || isMutating || (!contactId.trim() && !familyId.trim() && !organizationId.trim())}
              onClick={() => void handleSave()}
            >
              {isMutating ? 'Adding...' : 'Add Enrollment'}
            </Button>
          )}
          {isEditMode ? (
            <Button type='button' variant='secondary' disabled={isMutating} onClick={resetCreateForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </Card>

      <PaginatedTableCard
        title='Existing Enrollments'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading enrollments...'
        onLoadMore={onLoadMore}
      >
        <div className='rounded-md border border-slate-200'>
          <table className='w-full min-w-[840px] divide-y divide-slate-200 text-left'>
            <thead className='bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700'>
              <tr>
                <th className='px-4 py-3 font-semibold'>Parent</th>
                <th className='px-4 py-3 font-semibold'>Status</th>
                <th className='px-4 py-3 font-semibold'>Amount</th>
                <th className='px-4 py-3 font-semibold'>Enrolled at</th>
                <th className='px-4 py-3 font-semibold text-right'>Operations</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-200 bg-white text-sm'>
              {enrollments.map((enrollment) => (
                <tr
                  key={enrollment.id}
                  className={`cursor-pointer transition ${
                    selectedEnrollmentId === enrollment.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => applyEnrollmentSelection(enrollment)}
                >
                  <td className='px-4 py-3'>
                    {enrollment.contactId ?? enrollment.familyId ?? enrollment.organizationId ?? '-'}
                  </td>
                  <td className='px-4 py-3'>{formatEnumLabel(enrollment.status)}</td>
                  <td className='px-4 py-3'>
                    {enrollment.amountPaid ? `${enrollment.amountPaid} ${enrollment.currency ?? ''}` : '-'}
                  </td>
                  <td className='px-4 py-3'>{formatDate(enrollment.enrolledAt)}</td>
                  <td className='px-4 py-3 text-right'>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      disabled={isMutating}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteEnrollment(enrollment);
                      }}
                      aria-label='Delete enrollment'
                      title='Delete enrollment'
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
