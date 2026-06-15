'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';

import type { useAdminEntityOrganizations } from '@/hooks/use-admin-entity-organizations';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { useEntityInlineLocation } from '@/hooks/use-entity-inline-location';
import { useEntityServiceLabels } from '@/hooks/use-entity-service-labels';
import { EntityInlineLocationSection } from '@/components/admin/contacts/shared/entity-inline-location-section';
import { EntityMembersSection } from '@/components/admin/contacts/shared/entity-members-section';
import type { InlineLocationEmbeddedSummary } from '@/components/admin/locations/inline-location-editor';
import { EntityServicesSection } from '@/components/admin/contacts/entity-services-section';
import { EntityTagPicker } from '@/components/admin/contacts/entity-tag-picker';
import { DeleteIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableCell,
  AdminDataTableHead,
  AdminDataTableHeadCell,
  AdminDataTableOperationsHeadCell,
} from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { AdminTableToolbar } from '@/components/ui/admin-table-toolbar';
import { Select } from '@/components/ui/select';
import { contactEligibleForEntityMembership } from '@/lib/entity-contact-eligibility';
import type { EntityTagRef } from '@/lib/entity-api';
import { listAdminOrganizationServices } from '@/lib/entity-api';
import { formatEnumLabel, formatFamilyOrOrganizationPartyLabel } from '@/lib/format';
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
    updateMember,
    deleteOrganization,
    relationshipOptions,
  } = organizations;

  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [pendingLocationLeaveDialogProps, requestPendingLocationLeaveConfirm] = useConfirmDialog();
  const [deleteActionError, setDeleteActionError] = useState('');

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [organizationType, setOrganizationType] =
    useState<ApiSchemas['EntityOrganizationType']>('company');
  const [relationshipType, setRelationshipType] =
    useState<ApiSchemas['EntityOrganizationRelationshipType']>('prospect');
  const [website, setWebsite] = useState('');
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [optimisticLocationSummary, setOptimisticLocationSummary] =
    useState<InlineLocationEmbeddedSummary | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const serviceLabels = useEntityServiceLabels(
    editorMode,
    selectedId,
    useCallback((entityId, signal) => listAdminOrganizationServices(entityId, signal), [])
  );

  const [memberContactId, setMemberContactId] = useState('');

  const [removeTarget, setRemoveTarget] = useState<{ memberId: string; label: string } | null>(
    null
  );

  const selected = useMemo(
    () => rows.find((o) => o.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const {
    inlineLocationStateKey,
    resolvedLocation,
    embeddedLocationSummary,
    locationSaveStatus,
    locationGeocoding,
    geocodeLocation,
    updateSharedLocation,
    clearLocationSaveError,
    clearPendingLocation,
    saveNewLocation,
  } = useEntityInlineLocation({
    editorMode,
    selectedId,
    stateKeyPrefix: 'org',
    pendingLocationId,
    setPendingLocationId,
    optimisticLocationSummary,
    setOptimisticLocationSummary,
    selectedLocationSummary: selected?.location_summary,
    locations,
    geographicAreas,
    refreshLocations,
  });

  const locationLockedReadOnly = Boolean(resolvedLocation?.lockedFromPartnerOrg);

  const memberContactOptions = useMemo(() => {
    return contactOptions.filter((c) => {
      const row = contactsForMembership.find((x) => x.id === c.id);
      if (!row) {
        return true;
      }
      return contactEligibleForEntityMembership(row, selectedId, 'organization');
    });
  }, [contactOptions, contactsForMembership, selectedId]);

  const primaryMemberLabel = useCallback((members: ApiSchemas['AdminOrganizationMember'][]) => {
    const primary = members.find((m) => m.is_primary_contact);
    return primary?.contact_label?.trim() || null;
  }, []);

  async function handlePrimaryMemberChange(
    memberId: string,
    nextChecked: boolean
  ): Promise<void> {
    if (!selected) {
      return;
    }
    try {
      await updateMember(selected.id, memberId, { is_primary_contact: nextChecked });
    } catch {
      // Retry preserved.
    }
  }

  async function resetCreateForm() {
    if (editorMode === 'create' && pendingLocationId) {
      const ok = await requestPendingLocationLeaveConfirm({
        title: 'Leave without finishing?',
        description:
          'You saved an address to a new location but have not finished creating this organisation yet. Leave anyway? The location row stays in the directory.',
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        variant: 'default',
      });
      if (!ok) {
        return;
      }
    }
    setEditorMode('create');
    setSelectedId(null);
    setName('');
    setOrganizationType('company');
    setRelationshipType('prospect');
    setWebsite('');
    setPendingLocationId(null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setTagIds([]);
    setActive(true);
    setMemberContactId('');
  }

  async function handleSubmit(): Promise<void> {
    try {
      const loc = pendingLocationId;
      if (editorMode === 'create') {
        await createOrganization({
          name: name.trim(),
          organization_type: organizationType,
          relationship_type: relationshipType,
          website: website.trim() || null,
          location_id: loc,
          tag_ids: tagIds,
        });
        await resetCreateForm();
        return;
      }
      if (!selected) {
        return;
      }
      await updateOrganization(selected.id, {
        name: name.trim(),
        organization_type: organizationType,
        relationship_type: relationshipType,
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
        is_primary_contact: false,
      });
      setMemberContactId('');
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
        await resetCreateForm();
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
      <ConfirmDialog {...pendingLocationLeaveDialogProps} />
      <AdminEditorCard
        title='Organisation'
        description='CRM organisations only. Vendors are managed under Finance → Vendors; partners under Services → Partners.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button
                type='button'
                variant='secondary'
                onClick={() => void resetCreateForm()}
                disabled={isSaving}
              >
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
              }}
            >
              {relationshipOptions.map((v) => (
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
          <div className='lg:col-span-1'>
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
          <div className='lg:col-span-1'>
            {editorMode === 'edit' ? (
              <>
                <Label htmlFor='crm-org-active'>Status</Label>
                <Select
                  id='crm-org-active'
                  value={active ? 'true' : 'false'}
                  onChange={(e) => setActive(e.target.value === 'true')}
                >
                  <option value='true'>Active</option>
                  <option value='false'>Archived</option>
                </Select>
              </>
            ) : null}
          </div>
          <div className='lg:col-span-4'>
            <EntityInlineLocationSection
              sectionId='crm-org-location'
              stateKey={inlineLocationStateKey}
              location={resolvedLocation}
              embeddedSummary={embeddedLocationSummary}
              areas={geographicAreas}
              areasLoading={areasLoading}
              isSaving={isSaving || locationSaveStatus.isSaving}
              isGeocoding={locationGeocoding}
              saveError={locationSaveStatus.error}
              allowClearWhenLocked={locationLockedReadOnly}
              lockedSummaryExtra={
                locationLockedReadOnly
                  ? 'To change the venue name or switch to a different address, use Services → Venues or update the partner organisation record.'
                  : null
              }
              onSaveCreate={saveNewLocation}
              onSaveUpdate={async (id, payload) => {
                await updateSharedLocation(id, payload);
              }}
              onClear={clearPendingLocation}
              onGeocode={geocodeLocation}
            />
          </div>
          <div className='lg:col-span-4 space-y-4'>
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
            <EntityServicesSection id='crm-org-services' labels={serviceLabels} />
          </div>
          {editorMode === 'edit' && selected ? (
            <div className='lg:col-span-4'>
              <EntityMembersSection
                sectionId='crm-org-members'
                contactSelectId='crm-org-member-contact'
                entityLabel='organisation'
                helpText='Role for each member follows the contact type set on the contact record.'
                members={selected.members}
                memberContactId={memberContactId}
                memberContactOptions={memberContactOptions}
                isSaving={isSaving}
                onMemberContactIdChange={setMemberContactId}
                onAddMember={() => void handleAddMember()}
                onPrimaryChange={(memberId, checked) => {
                  void handlePrimaryMemberChange(memberId, checked);
                }}
                onRemoveRequest={(memberId, label) => setRemoveTarget({ memberId, label })}
              />
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
          <AdminTableToolbar>
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
          </AdminTableToolbar>
        }
      >
        <AdminDataTable tableClassName='min-w-[800px]'>
          <AdminDataTableHead>
            <tr>
              <AdminDataTableHeadCell>Name</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Type</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Members</AdminDataTableHeadCell>
              <AdminDataTableHeadCell>Status</AdminDataTableHeadCell>
              <AdminDataTableOperationsHeadCell />
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {rows.map((row) => {
              const primaryLabel = primaryMemberLabel(row.members);
              return (
              <tr
                key={row.id}
                className={`cursor-pointer transition ${
                  selectedId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => selectRow(row.id)}
              >
                <AdminDataTableCell>
                  {formatFamilyOrOrganizationPartyLabel(row.name, primaryLabel) || '—'}
                </AdminDataTableCell>
                <AdminDataTableCell>{formatEnumLabel(row.organization_type)}</AdminDataTableCell>
                <AdminDataTableCell>{row.members.length}</AdminDataTableCell>
                <AdminDataTableCell>{row.active ? 'Active' : 'Archived'}</AdminDataTableCell>
                <AdminDataTableCell className='text-right'>
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
                </AdminDataTableCell>
              </tr>
              );
            })}
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
