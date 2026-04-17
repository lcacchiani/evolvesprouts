'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CopyIcon, DeleteIcon, QrLinkIcon } from '@/components/icons/action-icons';
import { ReferralLinkQrDialog } from '@/components/admin/services/referral-link-qr-dialog';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useServiceInstanceOptions } from '@/hooks/use-service-instance-options';
import {
  DISCOUNT_VALIDITY_RANGE_INVERTED_MESSAGE,
  isDiscountValidityRangeInverted,
} from '@/lib/discount-validity';
import {
  formatDate,
  formatEnumLabel,
  formatIsoForDatetimeLocalInput,
  getCurrencyOptions,
  parseDatetimeLocalToIsoUtc,
} from '@/lib/format';

import type { components } from '@/types/generated/admin-api.generated';
import { DISCOUNT_TYPES } from '@/types/services';
import type { DiscountCode, DiscountCodeFilters, DiscountType, ServiceSummary } from '@/types/services';

type ApiSchemas = components['schemas'];

function formatScopeSummary(row: DiscountCode, serviceById: Map<string, ServiceSummary>): string {
  if (!row.serviceId && !row.instanceId) {
    return 'All services';
  }
  const title = row.serviceId ? serviceById.get(row.serviceId)?.title ?? 'Service' : 'Service';
  if (row.instanceId) {
    const short = row.instanceId.replace(/-/g, '').slice(0, 8);
    return `${title} · instance ${short}`;
  }
  return title;
}

function serviceOptionLabel(svc: ServiceSummary): string {
  return `${svc.title} · ${formatEnumLabel(svc.status)}`;
}

export interface DiscountCodesPanelProps {
  codes: DiscountCode[];
  filters: DiscountCodeFilters;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSaving: boolean;
  hasMore: boolean;
  error: string;
  /** Services for scope pickers; defaults to [] when omitted (e.g. tests). */
  serviceOptions?: ServiceSummary[];
  showArchivedServices?: boolean;
  onShowArchivedChange?: (value: boolean) => void;
  onFilterChange: <TKey extends keyof DiscountCodeFilters>(
    key: TKey,
    value: DiscountCodeFilters[TKey]
  ) => void;
  onLoadMore: () => Promise<void> | void;
  onCreate: (payload: ApiSchemas['CreateDiscountCodeRequest']) => Promise<unknown> | void;
  onUpdate: (
    codeId: string,
    payload: ApiSchemas['UpdateDiscountCodeRequest']
  ) => Promise<unknown> | void;
  onDelete: (codeId: string) => Promise<void> | void;
}

export function DiscountCodesPanel({
  codes,
  filters,
  isLoading,
  isLoadingMore,
  isSaving,
  hasMore,
  error,
  serviceOptions = [],
  showArchivedServices = false,
  onShowArchivedChange,
  onFilterChange,
  onLoadMore,
  onCreate,
  onUpdate,
  onDelete,
}: DiscountCodesPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [scopeConfirmProps, requestScopeConfirm] = useConfirmDialog();
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<ApiSchemas['DiscountType']>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [currency, setCurrency] = useState('HKD');
  const [maxUses, setMaxUses] = useState('');
  const [active, setActive] = useState(true);
  const [validFromLocal, setValidFromLocal] = useState('');
  const [validUntilLocal, setValidUntilLocal] = useState('');
  const [validityRangeError, setValidityRangeError] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const { instances, isLoading: instancesLoading, error: instancesError, loadForService } =
    useServiceInstanceOptions();
  const currencyOptions = getCurrencyOptions();

  const serviceById = useMemo(() => {
    const map = new Map<string, ServiceSummary>();
    for (const svc of serviceOptions) {
      map.set(svc.id, svc);
    }
    return map;
  }, [serviceOptions]);

  const selectedCode = useMemo(
    () => codes.find((entry) => entry.id === selectedCodeId) ?? null,
    [codes, selectedCodeId]
  );

  useEffect(() => {
    void loadForService(serviceId.trim() || null);
  }, [loadForService, serviceId]);

  const resetCreateForm = () => {
    setEditorMode('create');
    setSelectedCodeId(null);
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('');
    setCurrency('HKD');
    setMaxUses('');
    setActive(true);
    setValidFromLocal('');
    setValidUntilLocal('');
    setValidityRangeError('');
    setServiceId('');
    setInstanceId('');
  };

  const handleSubmit = async () => {
    if (isDiscountValidityRangeInverted(validFromLocal, validUntilLocal)) {
      setValidityRangeError(DISCOUNT_VALIDITY_RANGE_INVERTED_MESSAGE);
      return;
    }
    setValidityRangeError('');
    const validFromIso = parseDatetimeLocalToIsoUtc(validFromLocal);
    const validUntilIso = parseDatetimeLocalToIsoUtc(validUntilLocal);
    const serviceUuid = serviceId.trim() || null;
    const instanceUuid = serviceUuid && instanceId.trim() ? instanceId.trim() : null;
    const createPayload: ApiSchemas['CreateDiscountCodeRequest'] = {
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      discount_type: discountType as DiscountType,
      discount_value: discountValue.trim(),
      currency: currency.trim() || null,
      valid_from: validFromIso,
      valid_until: validUntilIso,
      max_uses: maxUses ? Number(maxUses) : null,
      active,
      service_id: serviceUuid,
      instance_id: instanceUuid,
    };
    try {
      if (editorMode === 'create') {
        await onCreate(createPayload);
        resetCreateForm();
        return;
      }
      if (!selectedCode) {
        return;
      }
      const prevService = selectedCode.serviceId ?? null;
      const prevInstance = selectedCode.instanceId ?? null;
      const scopeChanged =
        (serviceUuid ?? null) !== (prevService ?? null) ||
        (instanceUuid ?? null) !== (prevInstance ?? null);
      if (selectedCode.currentUses > 0 && scopeChanged) {
        const ok = await requestScopeConfirm({
          title: 'Change discount scope?',
          description: `This code has been used ${selectedCode.currentUses} times. Changing scope won't retroactively affect past bookings, but future validations and redemptions will follow the new scope. Continue?`,
          confirmLabel: 'Continue',
          cancelLabel: 'Cancel',
          variant: 'default',
        });
        if (!ok) {
          return;
        }
      }
      await onUpdate(selectedCode.id, {
        description: description.trim() || null,
        discount_type: discountType as DiscountType,
        discount_value: discountValue.trim(),
        currency: currency.trim() || null,
        valid_from: validFromIso,
        valid_until: validUntilIso,
        max_uses: maxUses ? Number(maxUses) : null,
        active,
        service_id: serviceUuid,
        instance_id: instanceUuid,
      });
    } catch {
      // Keep inline form state visible to let users retry.
    }
  };

  const applyCodeSelection = (entry: DiscountCode) => {
    setSelectedCodeId(entry.id);
    setEditorMode('edit');
    setCode(entry.code);
    setDescription(entry.description ?? '');
    setDiscountType(entry.discountType);
    setDiscountValue(entry.discountValue);
    setCurrency(entry.currency ?? 'HKD');
    setMaxUses(entry.maxUses?.toString() ?? '');
    setActive(entry.active);
    setValidFromLocal(formatIsoForDatetimeLocalInput(entry.validFrom));
    setValidUntilLocal(formatIsoForDatetimeLocalInput(entry.validUntil));
    setValidityRangeError('');
    setServiceId(entry.serviceId ?? '');
    setInstanceId(entry.instanceId ?? '');
  };

  const handleDeleteCode = async (entry: DiscountCode) => {
    const confirmed = await requestConfirm({
      title: 'Delete discount code',
      description: `Delete "${entry.code}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDelete(entry.id);
    if (selectedCodeId === entry.id) {
      resetCreateForm();
    }
  };

  async function handleCopyCode(value: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(value.trim().toUpperCase());
  }

  function openReferralDialog(entry: DiscountCode) {
    setReferralCode(entry.code);
    setReferralOpen(true);
  }

  function canShowReferralQr(entry: DiscountCode): boolean {
    if (!entry.serviceId) {
      return false;
    }
    const slug = serviceById.get(entry.serviceId)?.slug?.trim().toLowerCase() ?? '';
    return slug === 'my-best-auntie';
  }

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Discount Code'
        description='Create a new code or select a row below to update. Codes cannot be changed after creation.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button
              type='button'
              disabled={
                isSaving ||
                !code.trim() ||
                !discountValue.trim() ||
                isDiscountValidityRangeInverted(validFromLocal, validUntilLocal)
              }
              onClick={() => void handleSubmit()}
            >
              {editorMode === 'create' ? 'Create code' : 'Update code'}
            </Button>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <div>
            <Label htmlFor='discount-code'>Code</Label>
            <Input
              id='discount-code'
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              disabled={editorMode === 'edit'}
            />
          </div>
          <div>
            <Label htmlFor='discount-type'>Type</Label>
            <Select
              id='discount-type'
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as ApiSchemas['DiscountType'])}
            >
              {DISCOUNT_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {formatEnumLabel(entry)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='discount-valid-from'>Valid from</Label>
            <Input
              id='discount-valid-from'
              type='datetime-local'
              value={validFromLocal}
              onChange={(event) => {
                setValidFromLocal(event.target.value);
                setValidityRangeError('');
              }}
            />
          </div>
          <div>
            <Label htmlFor='discount-valid-until'>Valid until</Label>
            <Input
              id='discount-valid-until'
              type='datetime-local'
              value={validUntilLocal}
              onChange={(event) => {
                setValidUntilLocal(event.target.value);
                setValidityRangeError('');
              }}
            />
          </div>
        </div>
        {validityRangeError ? <p className='text-sm text-red-600'>{validityRangeError}</p> : null}
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div>
            <Label htmlFor='discount-service'>Applies to service</Label>
            <Select
              id='discount-service'
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setInstanceId('');
              }}
            >
              <option value=''>All services</option>
              {serviceOptions.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {serviceOptionLabel(svc)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='discount-instance'>Applies to instance</Label>
            <Select
              id='discount-instance'
              value={instanceId}
              onChange={(event) => setInstanceId(event.target.value)}
              disabled={!serviceId.trim()}
            >
              <option value=''>All instances</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.resolvedTitle ?? inst.title ?? inst.id}
                </option>
              ))}
            </Select>
            {instancesLoading ? <p className='text-xs text-slate-500'>Loading instances…</p> : null}
            {instancesError ? <p className='text-xs text-red-600'>{instancesError}</p> : null}
          </div>
        </div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-4'>
          <div>
            <Label htmlFor='discount-value'>Value</Label>
            <Input id='discount-value' value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='discount-currency'>Currency</Label>
            <Select
              id='discount-currency'
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled={discountType === 'percentage'}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='discount-max-uses'>Max uses</Label>
            <Input id='discount-max-uses' value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
          </div>
          <div>
            <Label htmlFor='discount-active'>Active</Label>
            <Select
              id='discount-active'
              value={active ? 'true' : 'false'}
              onChange={(event) => setActive(event.target.value === 'true')}
            >
              <option value='true'>Enabled</option>
              <option value='false'>Disabled</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor='discount-description'>Description</Label>
          <Textarea
            id='discount-description'
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Discount Codes'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading discount codes...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[140px]'>
              <Label htmlFor='discount-filter-active'>Status</Label>
              <Select
                id='discount-filter-active'
                value={filters.active}
                onChange={(event) => onFilterChange('active', event.target.value as DiscountCodeFilters['active'])}
              >
                <option value=''>All</option>
                <option value='true'>Active</option>
                <option value='false'>Inactive</option>
              </Select>
            </div>
            <div className='min-w-[180px]'>
              <Label htmlFor='discount-filter-scope'>Scope</Label>
              <Select
                id='discount-filter-scope'
                value={filters.scope}
                onChange={(event) =>
                  onFilterChange('scope', event.target.value as DiscountCodeFilters['scope'])
                }
              >
                <option value=''>All scopes</option>
                <option value='unscoped'>All services</option>
                <option value='service'>Service only</option>
                <option value='instance'>Instance-scoped</option>
              </Select>
            </div>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='discount-filter-search'>Search</Label>
              <Input
                id='discount-filter-search'
                value={filters.search}
                onChange={(event) => onFilterChange('search', event.target.value)}
                placeholder='Code'
              />
            </div>
            {onShowArchivedChange ? (
              <div className='flex min-w-[140px] items-center gap-2 pt-6'>
                <input
                  id='discount-filter-archived'
                  type='checkbox'
                  className='h-4 w-4 rounded border-slate-300 text-slate-900'
                  checked={showArchivedServices}
                  onChange={(event) => onShowArchivedChange(event.target.checked)}
                />
                <Label htmlFor='discount-filter-archived' className='cursor-pointer font-normal'>
                  Show archived
                </Label>
              </div>
            ) : null}
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[1040px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Code</th>
              <th className='px-4 py-3 font-semibold'>Scope</th>
              <th className='px-4 py-3 font-semibold'>Valid from</th>
              <th className='px-4 py-3 font-semibold'>Valid until</th>
              <th className='px-4 py-3 font-semibold'>Value</th>
              <th className='px-4 py-3 font-semibold'>Uses</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {codes.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer transition ${
                  selectedCodeId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => applyCodeSelection(row)}
              >
                <td className='px-4 py-3'>{row.code}</td>
                <td className='px-4 py-3 text-sm text-slate-700'>{formatScopeSummary(row, serviceById)}</td>
                <td className='px-4 py-3'>{formatDate(row.validFrom)}</td>
                <td className='px-4 py-3'>{formatDate(row.validUntil)}</td>
                <td className='px-4 py-3'>
                  {row.discountType === 'percentage'
                    ? `${row.discountValue}%`
                    : `${row.discountValue} ${row.currency ?? ''}`.trim()}
                </td>
                <td className='px-4 py-3'>
                  {row.currentUses}/{row.maxUses ?? '∞'}
                </td>
                <td className='px-4 py-3'>{row.active ? 'Enabled' : 'Disabled'}</td>
                <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                  <div className='flex justify-end gap-1'>
                    {canShowReferralQr(row) ? (
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        disabled={isSaving}
                        onClick={() => openReferralDialog(row)}
                        aria-label='Referral link and QR'
                        title='Referral link and QR'
                      >
                        <QrLinkIcon className='h-4 w-4' />
                      </Button>
                    ) : null}
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      disabled={isSaving}
                      onClick={() => void handleCopyCode(row.code)}
                      aria-label='Copy discount code'
                      title='Copy code'
                    >
                      <CopyIcon className='h-4 w-4' />
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      disabled={isSaving}
                      onClick={() => void handleDeleteCode(row)}
                      aria-label='Delete discount code'
                      title='Delete discount code'
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
      <ConfirmDialog {...scopeConfirmProps} />
      <ReferralLinkQrDialog
        open={referralOpen}
        discountCode={referralCode}
        onClose={() => setReferralOpen(false)}
      />
    </div>
  );
}
