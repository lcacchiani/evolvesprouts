'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { formatEnumLabel } from '@/lib/format';

import type { components } from '@/types/generated/admin-api.generated';
import type { GeographicAreaSummary, LocationSummary, VenueFilters } from '@/types/services';

type ApiSchemas = components['schemas'];

export interface VenuesPanelProps {
  venues: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  filters: VenueFilters;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSaving: boolean;
  hasMore: boolean;
  error: string;
  onFilterChange: <TKey extends keyof VenueFilters>(key: TKey, value: VenueFilters[TKey]) => void;
  onLoadMore: () => Promise<void> | void;
  onCreate: (payload: ApiSchemas['CreateLocationRequest']) => Promise<unknown> | void;
  onUpdate: (venueId: string, payload: ApiSchemas['UpdateLocationRequest']) => Promise<unknown> | void;
  onDelete: (venueId: string) => Promise<void> | void;
}

function parseOptionalCoordinate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

export function VenuesPanel({
  venues,
  geographicAreas,
  areasLoading,
  filters,
  isLoading,
  isLoadingMore,
  isSaving,
  hasMore,
  error,
  onFilterChange,
  onLoadMore,
  onCreate,
  onUpdate,
  onDelete,
}: VenuesPanelProps) {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [areaId, setAreaId] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const areaOptions = useMemo(() => {
    return [...geographicAreas].sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });
  }, [geographicAreas]);

  const areaById = useMemo(() => new Map(geographicAreas.map((a) => [a.id, a])), [geographicAreas]);

  const selectedVenue = useMemo(
    () => venues.find((entry) => entry.id === selectedVenueId) ?? null,
    [venues, selectedVenueId]
  );

  const areasReady = !areasLoading && areaOptions.length > 0;
  const latTrim = lat.trim();
  const lngTrim = lng.trim();
  const latNum = parseOptionalCoordinate(lat);
  const lngNum = parseOptionalCoordinate(lng);
  const latParseError = latTrim !== '' && Number.isNaN(latNum);
  const lngParseError = lngTrim !== '' && Number.isNaN(lngNum);
  const latRangeError =
    latTrim !== '' && !latParseError && latNum !== null && (latNum < -90 || latNum > 90);
  const lngRangeError =
    lngTrim !== '' && !lngParseError && lngNum !== null && (lngNum < -180 || lngNum > 180);
  const coordinatesInvalid = latParseError || lngParseError || latRangeError || lngRangeError;
  const onlyOneCoordinate =
    (latTrim !== '') !== (lngTrim !== '') && !latParseError && !lngParseError;
  const canSubmit =
    areasReady &&
    Boolean(areaId) &&
    !coordinatesInvalid &&
    !onlyOneCoordinate;

  const resetCreateForm = () => {
    setEditorMode('create');
    setSelectedVenueId(null);
    setAreaId('');
    setAddress('');
    setLat('');
    setLng('');
  };

  const handleSubmit = async () => {
    if (!areaId || coordinatesInvalid || onlyOneCoordinate) {
      return;
    }
    const latValue: number | null = latTrim === '' ? null : latNum;
    const lngValue: number | null = lngTrim === '' ? null : lngNum;
    const payload: ApiSchemas['CreateLocationRequest'] = {
      area_id: areaId,
      address: address.trim() || null,
      lat: latValue,
      lng: lngValue,
    };
    try {
      if (editorMode === 'create') {
        await onCreate(payload);
        resetCreateForm();
        return;
      }
      if (!selectedVenue) {
        return;
      }
      await onUpdate(selectedVenue.id, payload);
    } catch {
      // Keep inline form state visible to let users retry.
    }
  };

  const applyVenueSelection = (entry: LocationSummary) => {
    setSelectedVenueId(entry.id);
    setEditorMode('edit');
    setAreaId(entry.areaId);
    setAddress(entry.address ?? '');
    setLat(entry.lat !== null ? String(entry.lat) : '');
    setLng(entry.lng !== null ? String(entry.lng) : '');
  };

  const handleDeleteVenue = async (entry: LocationSummary) => {
    const label = entry.address?.trim() || 'this venue';
    const confirmed = await requestConfirm({
      title: 'Delete venue',
      description: `Delete ${label}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    await onDelete(entry.id);
    if (selectedVenueId === entry.id) {
      resetCreateForm();
    }
  };

  const editorFormId = 'venues-editor-form';

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Venue'
        description='Create a venue or select a row below to update. Geographic area is required.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button
              type='submit'
              form={editorFormId}
              disabled={isSaving || !canSubmit}
            >
              {editorMode === 'create' ? 'Create venue' : 'Update venue'}
            </Button>
          </>
        }
      >
        <form
          id={editorFormId}
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <Label htmlFor='venue-area'>Geographic area</Label>
              <Select
                id='venue-area'
                value={areaId}
                onChange={(event) => setAreaId(event.target.value)}
                disabled={!areasReady || isSaving}
              >
                <option value=''>{areasLoading ? 'Loading areas…' : 'Select an area'}</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({formatEnumLabel(area.level)})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor='venue-address'>Address</Label>
              <Input
                id='venue-address'
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <Label htmlFor='venue-lat'>Latitude</Label>
              <Input
                id='venue-lat'
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                disabled={isSaving}
                inputMode='decimal'
              />
            </div>
            <div>
              <Label htmlFor='venue-lng'>Longitude</Label>
              <Input
                id='venue-lng'
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                disabled={isSaving}
                inputMode='decimal'
              />
            </div>
          </div>
          {(latParseError || lngParseError) ? (
            <p className='text-sm text-red-600'>Latitude and longitude must be valid numbers.</p>
          ) : null}
          {onlyOneCoordinate ? (
            <p className='text-sm text-red-600'>Provide both latitude and longitude, or leave both empty.</p>
          ) : null}
          {(latRangeError || lngRangeError) ? (
            <p className='text-sm text-red-600'>
              Latitude must be between -90 and 90; longitude between -180 and 180.
            </p>
          ) : null}
        </form>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Venues'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading venues...'
        onLoadMore={onLoadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[160px]'>
              <Label htmlFor='venues-filter-area'>Area</Label>
              <Select
                id='venues-filter-area'
                value={filters.areaId}
                onChange={(event) => onFilterChange('areaId', event.target.value)}
              >
                <option value=''>All areas</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='venues-filter-search'>Search</Label>
              <Input
                id='venues-filter-search'
                value={filters.search}
                onChange={(event) => onFilterChange('search', event.target.value)}
                placeholder='Address'
              />
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[720px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Address</th>
              <th className='px-4 py-3 font-semibold'>Area</th>
              <th className='px-4 py-3 font-semibold'>Coordinates</th>
              <th className='px-4 py-3 font-semibold'>Updated</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {venues.map((row) => {
              const area = areaById.get(row.areaId);
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer transition ${
                    selectedVenueId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => applyVenueSelection(row)}
                >
                  <td className='px-4 py-3'>{row.address?.trim() || '—'}</td>
                  <td className='px-4 py-3'>{area?.name ?? row.areaId}</td>
                  <td className='px-4 py-3'>
                    {row.lat !== null && row.lng !== null ? `${row.lat}, ${row.lng}` : '—'}
                  </td>
                  <td className='px-4 py-3'>{row.updatedAt ?? '—'}</td>
                  <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      disabled={isSaving}
                      onClick={() => void handleDeleteVenue(row)}
                      aria-label='Delete venue'
                      title='Delete venue'
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
