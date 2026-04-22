'use client';

import { useMemo, useState, type MouseEvent } from 'react';

import type { useAdminEntityOrganizations } from '@/hooks/use-admin-entity-organizations';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useGeocodeVenueAddress } from '@/hooks/use-geocode-venue-address';
import { useInlineLocationSave } from '@/hooks/use-inline-location-save';
import { InlineLocationEditor } from '@/components/admin/locations/inline-location-editor';
import type { InlineLocationEmbeddedSummary } from '@/components/admin/locations/inline-location-editor';
import { EntityTagPicker } from '@/components/admin/contacts/entity-tag-picker';
import { DeleteIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { AdminCollapsibleSection } from '@/components/ui/admin-collapsible-section';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatEnumLabel } from '@/lib/format';
import type { EntityTagRef } from '@/lib/entity-api';
import type { EntityListFilters } from '@/types/entity-list';
import {
  ORGANIZATION_RELATIONSHIP_TYPES,
  relationshipTypeForEditor,
} from '@/types/entity-relationship';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

const ORG_TYPES: ApiSchemas['EntityOrganizationType'][] = [
  'school',
  'company',
  'community_group',
  'ngo',
  'other',
];

const ORG_ROLES: ApiSchemas['EntityOrganizationRole'][] = [
  'admin',
  'staff',
  'teacher',
  'member',
  'client',
  'partner',
  'other',
];

function contactEligibleForOrgMember(
  contact: { id: string; family_ids: string[]; organization_ids: string[] },
  selectedOrgId: string | null
): boolean {
  if (contact.organization_ids.length === 0) {
    return true;
  }
  return Boolean(selectedOrgId && contact.organization_ids.includes(selectedOrgId));
}

export interface OrganizationsPanelProps {
  organizations: ReturnType<typeof useAdminEntityOrganizations>;
  tags: EntityTagRef[];
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
  contactOptions: { id: string; label: string }[];
  contactsForMembership: {
    id: string;
    contact_type?: ApiSchemas['EntityContactType'];
    family_ids: string[];
    organization_ids: string[];
  }[];
}

export function OrganizationsPanel({
  organizations,
  tags,
  locations,
  geographicAreas,
  areasLoading,
  refreshLocations,
  contactOptions,
  contactsForMembership,
}: OrganizationsPanelProps) {
  const {
    organizations: rows,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    isSaving,
    createOrganization,
    updateOrganization,
    addMember,
    removeMember,
    deleteOrganization,
    relationshipOptions,
  } = organizations;

  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [deleteActionError, setDeleteActionError] = useState('');

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [organizationType, setOrganizationType] =
    useState<ApiSchemas['EntityOrganizationType']>('company');
  const [relationshipType, setRelationshipType] =
    useState<ApiSchemas['EntityOrganizationRelationshipType']>('prospect');
  const [slug, setSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [optimisticLocationSummary, setOptimisticLocationSummary] =
    useState<InlineLocationEmbeddedSummary | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const [memberContactId, setMemberContactId] = useState('');
  const [memberRole, setMemberRole] = useState<ApiSchemas['EntityOrganizationRole']>('member');

  const [removeTarget, setRemoveTarget] = useState<{ memberId: string; label: string } | null>(
    null
  );

  const selected = useMemo(
    () => rows.find((o) => o.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const inlineLocationStateKey = editorMode === 'create' ? 'org-new' : `org:${selectedId ?? 'none'}`;

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

  const locationLockedReadOnly = Boolean(resolvedLocation?.lockedFromPartnerOrg);

  const memberContactOptions = useMemo(() => {
    return contactOptions.filter((c) => {
      const row = contactsForMembership.find((x) => x.id === c.id);
      if (!row) {
        return true;
      }
      return contactEligibleForOrgMember(row, selectedId);
    });
  }, [contactOptions, contactsForMembership, selectedId]);

  function resetCreateForm() {
    if (editorMode === 'create' && pendingLocationId && typeof window !== 'undefined') {
      const ok = window.confirm(
        'You saved an address to a new location but have not finished creating this organisation yet. Leave anyway? The location row stays in the directory.'
      );
      if (!ok) {
        return;
      }
    }
    setEditorMode('create');
    setSelectedId(null);
    setName('');
    setOrganizationType('company');
    setRelationshipType('prospect');
    setSlug('');
    setWebsite('');
    setPendingLocationId(null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setTagIds([]);
    setActive(true);
    setMemberContactId('');
    setMemberRole('member');
  }

  async function handleSubmit(): Promise<void> {
    try {
      const loc = pendingLocationId;
      if (editorMode === 'create') {
        await createOrganization({
          name: name.trim(),
          organization_type: organizationType,
          relationship_type: relationshipType,
          slug:
            relationshipType === 'partner' ? slug.trim() || null : null,
          website: website.trim() || null,
          location_id: loc,
          tag_ids: tagIds,
        });
        resetCreateForm();
        return;
      }
      if (!selected) {
        return;
      }
      await updateOrganization(selected.id, {
        name: name.trim(),
        organization_type: organizationType,
        relationship_type: relationshipType,
        slug:
          relationshipType === 'partner' ? slug.trim() || null : null,
        website: website.trim() || null,
        location_id: loc,
        active,
        tag_ids: tagIds,
      });
    } catch {
      // Retry preserved.
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
      });
      setMemberContactId('');
      setMemberRole('member');
    } catch {
      // Retry preserved.
    }
  }

  async function handleDeleteOrganization(
    row: ApiSchemas['AdminOrganization'],
    clickEvent: MouseEvent<HTMLButtonElement>
  ): Promise<void> {
    clickEvent.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Delete organisation',
      description: `Permanently delete "${row.name}"? This removes the organisation from the database and cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setDeleteActionError('');
    try {
      await deleteOrganization(row.id);
      if (selectedId === row.id) {
        resetCreateForm();
      }
    } catch (err) {
      setDeleteActionError(
        err instanceof Error ? err.message : 'Failed to delete organisation'
      );
    }
  }

  function selectRow(id: string) {
    const row = rows.find((o) => o.id === id);
    if (!row) {
      return;
    }
    setSelectedId(id);
    setEditorMode('edit');
    setName(row.name);
    setOrganizationType(row.organization_type);
    setRelationshipType(
      relationshipTypeForEditor(row.relationship_type, ORGANIZATION_RELATIONSHIP_TYPES)
    );
    setSlug(row.slug ?? '');
    setWebsite(row.website ?? '');
    setPendingLocationId(row.location_id ?? null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setTagIds([...row.tag_ids]);
    setActive(row.active);
  }

  return (
    <div className='space-y-6'>
      <ConfirmDialog {...confirmDialogProps} />
      <AdminEditorCard
        title='Organisation'
        description='Non-vendor organisations only. Vendors are managed under Finance.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button type='button' disabled={isSaving || !name.trim()} onClick={() => void handleSubmit()}>
              {editorMode === 'create' ? 'Create organisation' : 'Update organisation'}
            </Button>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
          <div className='lg:col-span-2'>
            <Label htmlFor='crm-org-name'>Name</Label>
            <Input
              id='crm-org-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='lg:col-span-1'>
            <Label htmlFor='crm-org-rel'>Relationship</Label>
            <Select
              id='crm-org-rel'
              value={relationshipType}
              onChange={(e) => {
                const next = e.target.value as ApiSchemas['EntityOrganizationRelationshipType'];
                setRelationshipType(next);
                if (next !== 'partner') {
                  setSlug('');
                }
              }}
            >
              {relationshipOptions.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          {relationshipType === 'partner' ? (
            <div className='lg:col-span-1'>
              <Label htmlFor='crm-org-slug'>Slug</Label>
              <Input
                id='crm-org-slug'
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoComplete='off'
                placeholder='e.g. acme-partners'
              />
            </div>
          ) : null}
          <div className='lg:col-span-2'>
            <Label htmlFor='crm-org-type'>Organisation type</Label>
            <Select
              id='crm-org-type'
              value={organizationType}
              onChange={(e) =>
                setOrganizationType(e.target.value as ApiSchemas['EntityOrganizationType'])
              }
            >
              {ORG_TYPES.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <div className='lg:col-span-2'>
            <Label htmlFor='crm-org-web'>Website</Label>
            <Input
              id='crm-org-web'
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='lg:col-span-4'>
            <AdminCollapsibleSection id='crm-org-location' title='Location'>
              <InlineLocationEditor
                stateKey={inlineLocationStateKey}
                location={resolvedLocation}
                embeddedSummary={embeddedLocationSummary}
                areas={geographicAreas}
                areasLoading={areasLoading}
                canModify
                allowClearWhenLocked={locationLockedReadOnly}
                lockedSummaryExtra={
                  locationLockedReadOnly
                    ? 'To change the venue name or switch to a different address, use Services → Venues or update the partner organisation record.'
                    : null
                }
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
            </AdminCollapsibleSection>
          </div>
          <div className='lg:col-span-4 space-y-4'>
            {editorMode === 'edit' ? (
              <div>
                <Label htmlFor='crm-org-active'>Status</Label>
                <Select
                  id='crm-org-active'
                  value={active ? 'true' : 'false'}
                  onChange={(e) => setActive(e.target.value === 'true')}
                >
                  <option value='true'>Active</option>
                  <option value='false'>Archived</option>
                </Select>
              </div>
            ) : null}
            <div>
              <EntityTagPicker
                id='crm-org-tags'
                label='Tags'
                tags={tags}
                selectedIds={tagIds}
                onChange={setTagIds}
                disabled={isSaving}
                variant='collapsible'
              />
            </div>
          </div>
          {editorMode === 'edit' && selected ? (
            <div className='lg:col-span-4'>
              <AdminCollapsibleSection id='crm-org-members' title='Members'>
                <div className='space-y-3 pt-1'>
                  <div className='flex flex-wrap items-end gap-3'>
                    <div className='min-w-[200px] flex-1'>
                      <Label htmlFor='crm-org-member-contact'>Contact</Label>
                      <Select
                        id='crm-org-member-contact'
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
                      <Label htmlFor='crm-org-member-role'>Role</Label>
                      <Select
                        id='crm-org-member-role'
                        value={memberRole}
                        onChange={(e) =>
                          setMemberRole(e.target.value as ApiSchemas['EntityOrganizationRole'])
                        }
                      >
                        {ORG_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {formatEnumLabel(r)}
                          </option>
                        ))}
                      </Select>
                    </div>
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
                          <td className='px-3 py-2'>{formatEnumLabel(m.role)}</td>
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
              </AdminCollapsibleSection>
            </div>
          ) : null}
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Organisations'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error || deleteActionError}
        loadingLabel='Loading organisations...'
        onLoadMore={loadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='crm-orgs-search'>Search</Label>
              <Input
                id='crm-orgs-search'
                value={filters.query}
                onChange={(e) => {
                  setDeleteActionError('');
                  setFilter('query', e.target.value);
                }}
                placeholder='Organisation name'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-orgs-active'>Status</Label>
              <Select
                id='crm-orgs-active'
                value={filters.active}
                onChange={(e) => {
                  setDeleteActionError('');
                  setFilter('active', e.target.value as EntityListFilters['active']);
                }}
              >
                <option value=''>All</option>
                <option value='true'>Active</option>
                <option value='false'>Archived</option>
              </Select>
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[800px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold'>Type</th>
              <th className='px-4 py-3 font-semibold'>Members</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
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
                <td className='px-4 py-3'>{row.name}</td>
                <td className='px-4 py-3'>{formatEnumLabel(row.organization_type)}</td>
                <td className='px-4 py-3'>{row.members.length}</td>
                <td className='px-4 py-3'>{row.active ? 'Active' : 'Archived'}</td>
                <td className='px-4 py-3 text-right'>
                  <div className='flex flex-wrap justify-end gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      className='h-8 min-w-8 px-0'
                      onClick={(e) => {
                        void handleDeleteOrganization(row, e);
                      }}
                      disabled={isSaving}
                      aria-label='Delete organisation'
                      title='Delete organisation'
                    >
                      <DeleteIcon className='h-4 w-4 shrink-0' aria-hidden />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>

      <ConfirmDialog
        open={removeTarget !== null}
        title='Remove organisation member'
        description={
          removeTarget
            ? `Remove ${removeTarget.label} from this organisation?`
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
