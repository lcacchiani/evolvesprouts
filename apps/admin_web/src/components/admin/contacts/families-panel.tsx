'use client';

import { useMemo, useState } from 'react';

import type { useAdminCrmFamilies } from '@/hooks/use-admin-crm-families';
import { useGeocodeVenueAddress } from '@/hooks/use-geocode-venue-address';
import { useInlineLocationSave } from '@/hooks/use-inline-location-save';
import { InlineLocationEditor } from '@/components/admin/locations/inline-location-editor';
import type { InlineLocationEmbeddedSummary } from '@/components/admin/locations/inline-location-editor';
import { CrmTagPicker } from '@/components/admin/contacts/crm-tag-picker';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/format';
import type { CrmTagRef } from '@/lib/crm-api';
import type { CrmListFilters } from '@/types/crm';
import {
  CRM_ENTITY_RELATIONSHIP_TYPES,
  relationshipTypeForCrmEditor,
} from '@/types/crm-relationship';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

const FAMILY_ROLES: ApiSchemas['CrmFamilyRole'][] = [
  'parent',
  'child',
  'helper',
  'guardian',
  'other',
];

function contactEligibleForFamilyMember(
  contact: { id: string; family_ids: string[]; organization_ids: string[] },
  selectedFamilyId: string | null
): boolean {
  if (contact.family_ids.length === 0) {
    return true;
  }
  return Boolean(selectedFamilyId && contact.family_ids.includes(selectedFamilyId));
}

export interface FamiliesPanelProps {
  families: ReturnType<typeof useAdminCrmFamilies>;
  tags: CrmTagRef[];
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
  contactOptions: { id: string; label: string }[];
  contactsForMembership: { id: string; family_ids: string[]; organization_ids: string[] }[];
}

export function FamiliesPanel({
  families,
  tags,
  locations,
  geographicAreas,
  areasLoading,
  refreshLocations,
  contactOptions,
  contactsForMembership,
}: FamiliesPanelProps) {
  const {
    families: rows,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    isSaving,
    createFamily,
    updateFamily,
    addMember,
    removeMember,
  } = families;

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [relationshipType, setRelationshipType] =
    useState<(typeof CRM_ENTITY_RELATIONSHIP_TYPES)[number]>('prospect');
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [optimisticLocationSummary, setOptimisticLocationSummary] =
    useState<InlineLocationEmbeddedSummary | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const [memberContactId, setMemberContactId] = useState('');
  const [memberRole, setMemberRole] = useState<ApiSchemas['CrmFamilyRole']>('parent');
  const [memberPrimary, setMemberPrimary] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<{ memberId: string; label: string } | null>(
    null
  );

  const selected = useMemo(
    () => rows.find((f) => f.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const inlineLocationStateKey =
    editorMode === 'create' ? 'family-new' : `family:${selectedId ?? 'none'}`;

  const resolvedLocation = useMemo(() => {
    if (!pendingLocationId) {
      return null;
    }
    return locations.find((l) => l.id === pendingLocationId) ?? null;
  }, [locations, pendingLocationId]);

  const embeddedLocationSummary = useMemo((): InlineLocationEmbeddedSummary | null => {
    if (resolvedLocation) {
      return null;
    }
    if (!pendingLocationId) {
      return null;
    }
    if (optimisticLocationSummary && optimisticLocationSummary.id === pendingLocationId) {
      return optimisticLocationSummary;
    }
    const s = selected?.location_summary;
    if (s && s.id === pendingLocationId) {
      return {
        id: s.id,
        name: s.name ?? null,
        address: s.address ?? null,
        areaName: s.area_name,
        areaId: s.area_id,
        lat: s.lat ?? null,
        lng: s.lng ?? null,
      };
    }
    return null;
  }, [resolvedLocation, pendingLocationId, optimisticLocationSummary, selected?.location_summary]);

  function summaryFromLocationRow(loc: LocationSummary): InlineLocationEmbeddedSummary {
    const areaName = geographicAreas.find((a) => a.id === loc.areaId)?.name ?? 'Unknown area';
    return {
      id: loc.id,
      name: loc.name,
      address: loc.address,
      areaName,
      areaId: loc.areaId,
      lat: loc.lat,
      lng: loc.lng,
    };
  }

  const {
    status: locationSaveStatus,
    createSharedLocation,
    updateSharedLocation,
    clearError: clearLocationSaveError,
  } = useInlineLocationSave(refreshLocations);
  const { geocode: geocodeLocation, isGeocoding: locationGeocoding } = useGeocodeVenueAddress();

  const memberContactOptions = useMemo(() => {
    return contactOptions.filter((c) => {
      const row = contactsForMembership.find((x) => x.id === c.id);
      if (!row) {
        return true;
      }
      return contactEligibleForFamilyMember(row, selectedId);
    });
  }, [contactOptions, contactsForMembership, selectedId]);

  function resetCreateForm() {
    if (editorMode === 'create' && pendingLocationId && typeof window !== 'undefined') {
      const ok = window.confirm(
        'You saved an address to a new location but have not finished creating this family yet. Leave anyway? The location row stays in the directory.'
      );
      if (!ok) {
        return;
      }
    }
    setEditorMode('create');
    setSelectedId(null);
    setFamilyName('');
    setRelationshipType('prospect');
    setPendingLocationId(null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setTagIds([]);
    setActive(true);
    setMemberContactId('');
    setMemberRole('parent');
    setMemberPrimary(false);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const loc = pendingLocationId;
      if (editorMode === 'create') {
        await createFamily({
          family_name: familyName.trim(),
          relationship_type: relationshipType,
          location_id: loc,
          tag_ids: tagIds,
        });
        resetCreateForm();
        return;
      }
      if (!selected) {
        return;
      }
      await updateFamily(selected.id, {
        family_name: familyName.trim(),
        relationship_type: relationshipType,
        location_id: loc,
        active,
        tag_ids: tagIds,
      });
    } catch {
      // Keep form state for retry.
    }
  }

  async function handleAddMember(): Promise<void> {
    if (!selected || !memberContactId.trim()) {
      return;
    }
    try {
      await addMember(selected.id, {
        contact_id: memberContactId.trim(),
        role: memberRole,
        is_primary_contact: memberPrimary,
      });
      setMemberContactId('');
      setMemberRole('parent');
      setMemberPrimary(false);
    } catch {
      // Retry preserved.
    }
  }

  function selectRow(id: string) {
    const row = rows.find((f) => f.id === id);
    if (!row) {
      return;
    }
    setSelectedId(id);
    setEditorMode('edit');
    setFamilyName(row.family_name);
    setRelationshipType(relationshipTypeForCrmEditor(row.relationship_type));
    setPendingLocationId(row.location_id ?? null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setTagIds([...row.tag_ids]);
    setActive(row.active);
  }

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Family'
        description='Create a family or select one below. Add members by linking an existing contact.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button
              type='button'
              disabled={isSaving || !familyName.trim()}
              onClick={() => void handleSubmit()}
            >
              {editorMode === 'create' ? 'Create family' : 'Update family'}
            </Button>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div>
            <Label htmlFor='crm-family-name'>Family name</Label>
            <Input
              id='crm-family-name'
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-family-rel'>Relationship</Label>
            <Select
              id='crm-family-rel'
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as (typeof CRM_ENTITY_RELATIONSHIP_TYPES)[number])
              }
            >
              {CRM_ENTITY_RELATIONSHIP_TYPES.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <div className='lg:col-span-2'>
            <div className='rounded-md border border-slate-200 bg-slate-50/40 p-3'>
              <InlineLocationEditor
                stateKey={inlineLocationStateKey}
                location={resolvedLocation}
                embeddedSummary={embeddedLocationSummary}
                areas={geographicAreas}
                areasLoading={areasLoading}
                canModify
                isSaving={isSaving || locationSaveStatus.isSaving}
                isGeocoding={locationGeocoding}
                saveError={locationSaveStatus.error}
                onRequestEdit={() => {}}
                onCancelEdit={() => {}}
                onSaveCreate={async (payload) => {
                  const created = await createSharedLocation(payload);
                  if (created) {
                    setPendingLocationId(created.id);
                    setOptimisticLocationSummary(summaryFromLocationRow(created));
                    return created.id;
                  }
                  return null;
                }}
                onSaveUpdate={async (id, payload) => {
                  await updateSharedLocation(id, payload);
                }}
                onClear={() => {
                  setPendingLocationId(null);
                  setOptimisticLocationSummary(null);
                  clearLocationSaveError();
                }}
                onGeocode={geocodeLocation}
              />
            </div>
          </div>
          {editorMode === 'edit' ? (
            <div>
              <Label htmlFor='crm-family-active'>Status</Label>
              <Select
                id='crm-family-active'
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
              >
                <option value='true'>Active</option>
                <option value='false'>Archived</option>
              </Select>
            </div>
          ) : null}
          <div className='lg:col-span-2'>
            <CrmTagPicker
              id='crm-family-tags'
              label='Tags'
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              disabled={isSaving}
            />
          </div>
          {editorMode === 'edit' && selected ? (
            <div className='lg:col-span-2 space-y-3 rounded-md border border-slate-200 bg-slate-50/40 p-4'>
              <h3 className='text-sm font-semibold text-slate-800'>Members</h3>
              <div className='flex flex-wrap items-end gap-3'>
                <div className='min-w-[200px] flex-1'>
                  <Label htmlFor='crm-family-member-contact'>Contact</Label>
                  <Select
                    id='crm-family-member-contact'
                    value={memberContactId}
                    onChange={(e) => setMemberContactId(e.target.value)}
                  >
                    <option value=''>Select contact</option>
                    {memberContactOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className='min-w-[140px]'>
                  <Label htmlFor='crm-family-member-role'>Role</Label>
                  <Select
                    id='crm-family-member-role'
                    value={memberRole}
                    onChange={(e) =>
                      setMemberRole(e.target.value as ApiSchemas['CrmFamilyRole'])
                    }
                  >
                    {FAMILY_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {formatEnumLabel(r)}
                      </option>
                    ))}
                  </Select>
                </div>
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='checkbox'
                    className='h-4 w-4 rounded border-slate-300'
                    checked={memberPrimary}
                    onChange={(e) => setMemberPrimary(e.target.checked)}
                  />
                  Primary contact
                </label>
                <Button
                  type='button'
                  disabled={isSaving || !memberContactId}
                  onClick={() => void handleAddMember()}
                >
                  Add member
                </Button>
              </div>
              <AdminDataTable tableClassName='min-w-[520px]'>
                <AdminDataTableHead>
                  <tr>
                    <th className='px-3 py-2 font-semibold'>Contact</th>
                    <th className='px-3 py-2 font-semibold'>Role</th>
                    <th className='px-3 py-2 font-semibold text-right'>Operations</th>
                  </tr>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {selected.members.map((m) => (
                    <tr key={m.id}>
                      <td className='px-3 py-2'>{m.contact_label || m.contact_id}</td>
                      <td className='px-3 py-2'>
                        {formatEnumLabel(m.role)}
                        {m.is_primary_contact ? ' · primary' : ''}
                      </td>
                      <td className='px-3 py-2 text-right'>
                        <Button
                          type='button'
                          size='sm'
                          variant='danger'
                          disabled={isSaving}
                          onClick={() =>
                            setRemoveTarget({
                              memberId: m.id,
                              label: m.contact_label || m.contact_id,
                            })
                          }
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            </div>
          ) : null}
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Families'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading families...'
        onLoadMore={loadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='crm-families-search'>Search</Label>
              <Input
                id='crm-families-search'
                value={filters.query}
                onChange={(e) => setFilter('query', e.target.value)}
                placeholder='Family name'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-families-active'>Status</Label>
              <Select
                id='crm-families-active'
                value={filters.active}
                onChange={(e) => setFilter('active', e.target.value as CrmListFilters['active'])}
              >
                <option value=''>All</option>
                <option value='true'>Active</option>
                <option value='false'>Archived</option>
              </Select>
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[640px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold'>Members</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer transition ${
                  selectedId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => selectRow(row.id)}
              >
                <td className='px-4 py-3'>{row.family_name}</td>
                <td className='px-4 py-3'>{row.members.length}</td>
                <td className='px-4 py-3'>{row.active ? 'Active' : 'Archived'}</td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>

      <ConfirmDialog
        open={removeTarget !== null}
        title='Remove family member'
        description={
          removeTarget
            ? `Remove ${removeTarget.label} from this family?`
            : 'Remove this member?'
        }
        variant='danger'
        confirmLabel='Remove'
        confirmDisabled={isSaving}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget || !selected) {
            setRemoveTarget(null);
            return;
          }
          void (async () => {
            try {
              await removeMember(selected.id, removeTarget.memberId);
            } finally {
              setRemoveTarget(null);
            }
          })();
        }}
      />
    </div>
  );
}
