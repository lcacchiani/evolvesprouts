'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
  onLoadMore,
  onCreate,
  onUpdate,
  onDelete,
}: EnrollmentListPanelProps) {
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
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

  const resetCreateForm = () => {
    setEditorMode('create');
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
      if (editorMode === 'create') {
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

  return (
    <PaginatedTableCard
      title='Enrollments'
      isLoading={isLoading}
      isLoadingMore={isLoadingMore}
      hasMore={hasMore}
      error={error}
      loadingLabel='Loading enrollments...'
      onLoadMore={onLoadMore}
      toolbar={
        <div className='mb-3 space-y-3'>
          <div className='flex items-center justify-between'>
            <p className='text-sm text-slate-600'>
              {editorMode === 'create' ? 'Create enrollment' : 'Edit selected enrollment'}
            </p>
            <div className='flex gap-2'>
              {editorMode === 'edit' ? (
                <Button type='button' size='sm' variant='secondary' onClick={resetCreateForm}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type='button' size='sm' onClick={resetCreateForm} disabled={!canCreate}>
                New enrollment
              </Button>
            </div>
          </div>
          {!canCreate ? (
            <p className='text-xs text-slate-500'>
              Select a service and instance before creating or editing enrollments.
            </p>
          ) : null}
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <div>
              <Label htmlFor='enrollment-contact-id'>Contact ID</Label>
              <Input id='enrollment-contact-id' value={contactId} onChange={(event) => setContactId(event.target.value)} />
            </div>
            <div>
              <Label htmlFor='enrollment-family-id'>Family ID</Label>
              <Input id='enrollment-family-id' value={familyId} onChange={(event) => setFamilyId(event.target.value)} />
            </div>
            <div>
              <Label htmlFor='enrollment-organization-id'>Organization ID</Label>
              <Input
                id='enrollment-organization-id'
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              />
            </div>
          </div>
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
          <div className='flex justify-end gap-2'>
            {editorMode === 'edit' && selectedEnrollment ? (
              <Button
                type='button'
                size='sm'
                variant='danger'
                onClick={async () => {
                  await onDelete(selectedEnrollment.id);
                  resetCreateForm();
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button
              type='button'
              size='sm'
              disabled={
                !canCreate ||
                (!contactId.trim() && !familyId.trim() && !organizationId.trim()) ||
                (editorMode === 'edit' && !selectedEnrollment)
              }
              onClick={() => void handleSave()}
            >
              {editorMode === 'create' ? 'Create enrollment' : 'Save enrollment'}
            </Button>
          </div>
        </div>
      }
    >
      <table className='w-full min-w-[760px] text-left text-sm'>
        <thead className='text-slate-500'>
          <tr>
            <th className='py-2 pr-3 font-medium'>Parent</th>
            <th className='py-2 pr-3 font-medium'>Status</th>
            <th className='py-2 pr-3 font-medium'>Amount</th>
            <th className='py-2 pr-3 font-medium'>Enrolled at</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((enrollment) => (
            <tr
              key={enrollment.id}
              className={`cursor-pointer border-t ${
                selectedEnrollmentId === enrollment.id ? 'bg-slate-100' : 'hover:bg-slate-50'
              }`}
              onClick={() => {
                setSelectedEnrollmentId(enrollment.id);
                setEditorMode('edit');
                setContactId(enrollment.contactId ?? '');
                setFamilyId(enrollment.familyId ?? '');
                setOrganizationId(enrollment.organizationId ?? '');
                setStatus(enrollment.status);
                setAmountPaid(enrollment.amountPaid ?? '');
                setCurrency(enrollment.currency ?? 'HKD');
                setNotes(enrollment.notes ?? '');
              }}
            >
              <td className='py-2 pr-3'>
                {enrollment.contactId ?? enrollment.familyId ?? enrollment.organizationId ?? '-'}
              </td>
              <td className='py-2 pr-3'>{formatEnumLabel(enrollment.status)}</td>
              <td className='py-2 pr-3'>
                {enrollment.amountPaid ? `${enrollment.amountPaid} ${enrollment.currency ?? ''}` : '-'}
              </td>
              <td className='py-2 pr-3'>{formatDate(enrollment.enrolledAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PaginatedTableCard>
  );
}
