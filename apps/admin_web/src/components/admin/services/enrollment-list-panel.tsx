'use client';

import { useMemo, useState } from 'react';

import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useEnrollmentParentPickers } from '@/hooks/use-enrollment-parent-pickers';
import { formatDate, formatEnumLabel, getCurrencyOptions } from '@/lib/format';

import type { components } from '@/types/generated/admin-api.generated';
import type { Enrollment } from '@/types/services';
import { ENROLLMENT_STATUSES } from '@/types/services';

type ApiSchemas = components['schemas'];

const EMPTY_PARENT_VALUE = '';

function ensureOption(
  options: { id: string; label: string }[],
  id: string | null | undefined,
  fallbackPrefix: string
): { id: string; label: string }[] {
  if (!id?.trim()) {
    return options;
  }
  if (options.some((o) => o.id === id)) {
    return options;
  }
  return [...options, { id, label: `${fallbackPrefix} (${id})` }];
}

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
  const currencyOptions = getCurrencyOptions();
  const {
    contactOptions,
    families,
    organizations,
    loading: parentPickersLoading,
    error: parentPickersError,
    labelByContactId,
    labelByFamilyId,
    labelByOrganizationId,
  } = useEnrollmentParentPickers(canCreate);
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

  const contactSelectOptions = useMemo(
    () => ensureOption(contactOptions, selectedEnrollment?.contactId ?? null, 'Contact'),
    [contactOptions, selectedEnrollment?.contactId]
  );
  const familySelectOptions = useMemo(
    () => ensureOption(families, selectedEnrollment?.familyId ?? null, 'Family'),
    [families, selectedEnrollment?.familyId]
  );
  const organizationSelectOptions = useMemo(
    () => ensureOption(organizations, selectedEnrollment?.organizationId ?? null, 'Organization'),
    [organizations, selectedEnrollment?.organizationId]
  );

  const formatEnrollmentParentCell = (enrollment: Enrollment): string => {
    if (enrollment.contactId) {
      return labelByContactId.get(enrollment.contactId) ?? enrollment.contactId;
    }
    if (enrollment.familyId) {
      return labelByFamilyId.get(enrollment.familyId) ?? enrollment.familyId;
    }
    if (enrollment.organizationId) {
      return labelByOrganizationId.get(enrollment.organizationId) ?? enrollment.organizationId;
    }
    return '-';
  };

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
      <AdminEditorCard
        title='Enrollment'
        description='Add or update an enrollment using the same fields below.'
        actions={
          <>
            {isEditMode ? (
              <Button type='button' variant='secondary' disabled={isMutating} onClick={resetCreateForm}>
                Cancel
              </Button>
            ) : null}
            {isEditMode ? (
              <Button
                type='button'
                disabled={isMutating || !selectedEnrollment}
                onClick={() => void handleSave()}
              >
                {isMutating ? 'Updating...' : 'Update enrollment'}
              </Button>
            ) : (
              <Button
                type='button'
                disabled={
                  !canCreate ||
                  isMutating ||
                  parentPickersLoading ||
                  (!contactId.trim() && !familyId.trim() && !organizationId.trim())
                }
                onClick={() => void handleSave()}
              >
                {isMutating ? 'Adding...' : 'Add enrollment'}
              </Button>
            )}
          </>
        }
      >
        {!canCreate ? (
          <p className='text-xs text-slate-500'>
            Select a service and instance before creating or editing enrollments.
          </p>
        ) : null}
        {canCreate && parentPickersError ? (
          <p className='text-xs text-red-600' role='alert'>
            {parentPickersError}
          </p>
        ) : null}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          <div>
            <Label htmlFor='enrollment-contact'>Contact</Label>
            <Select
              id='enrollment-contact'
              value={contactId || EMPTY_PARENT_VALUE}
              onChange={(event) => {
                const next = event.target.value;
                setContactId(next === EMPTY_PARENT_VALUE ? '' : next);
              }}
              disabled={isEditMode || parentPickersLoading}
              aria-busy={parentPickersLoading}
            >
              <option value={EMPTY_PARENT_VALUE}>None</option>
              {contactSelectOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='enrollment-family'>Family</Label>
            <Select
              id='enrollment-family'
              value={familyId || EMPTY_PARENT_VALUE}
              onChange={(event) => {
                const next = event.target.value;
                setFamilyId(next === EMPTY_PARENT_VALUE ? '' : next);
              }}
              disabled={isEditMode || parentPickersLoading}
              aria-busy={parentPickersLoading}
            >
              <option value={EMPTY_PARENT_VALUE}>None</option>
              {familySelectOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='enrollment-organization'>Organization</Label>
            <Select
              id='enrollment-organization'
              value={organizationId || EMPTY_PARENT_VALUE}
              onChange={(event) => {
                const next = event.target.value;
                setOrganizationId(next === EMPTY_PARENT_VALUE ? '' : next);
              }}
              disabled={isEditMode || parentPickersLoading}
              aria-busy={parentPickersLoading}
            >
              <option value={EMPTY_PARENT_VALUE}>None</option>
              {organizationSelectOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className='text-xs text-slate-500'>
          Contact, family, and organization are chosen when creating an enrollment and cannot be changed
          afterward.
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
            <Select
              id='enrollment-currency'
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor='enrollment-notes'>Notes</Label>
          <Textarea id='enrollment-notes' value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Enrollments'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading enrollments...'
        onLoadMore={onLoadMore}
      >
        <AdminDataTable tableClassName='min-w-[840px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Parent</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Amount</th>
              <th className='px-4 py-3 font-semibold'>Enrolled at</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {enrollments.map((enrollment) => (
              <tr
                key={enrollment.id}
                className={`cursor-pointer transition ${
                  selectedEnrollmentId === enrollment.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => applyEnrollmentSelection(enrollment)}
              >
                <td className='px-4 py-3'>{formatEnrollmentParentCell(enrollment)}</td>
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
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
