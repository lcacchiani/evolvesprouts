'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';

import type { useAdminEntityFamilies } from '@/hooks/use-admin-entity-families';
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
import type { EntityTagRef } from '@/lib/entity-api';
import { listAdminFamilyServices } from '@/lib/entity-api';
import { contactEligibleForEntityMembership } from '@/lib/entity-contact-eligibility';
import { formatEnumLabel, formatFamilyOrOrganizationPartyLabel } from '@/lib/format';
import type { EntityListFilters } from '@/types/entity-list';
import {
  FAMILY_RELATIONSHIP_TYPES,
  relationshipTypeForEditor,
} from '@/types/entity-relationship';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export interface FamiliesPanelProps {
  families: ReturnType<typeof useAdminEntityFamilies>;
  tags: EntityTagRef[];
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
  contactOptions: { id: string; label: string }[];
  contactsForMembership: {
    id: string;
    contact_type: ApiSchemas['EntityContactType'];
    family_ids: string[];
    organization_ids: string[];
  }[];
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
    updateMember,
    deleteFamily,
  } = families;

  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [pendingLocationLeaveDialogProps, requestPendingLocationLeaveConfirm] = useConfirmDialog();
  const [deleteActionError, setDeleteActionError] = useState('');

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [relationshipType, setRelationshipType] =
    useState<(typeof FAMILY_RELATIONSHIP_TYPES)[number]>('prospect');
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [optimisticLocationSummary, setOptimisticLocationSummary] =
    useState<InlineLocationEmbeddedSummary | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const serviceLabels = useEntityServiceLabels(
    editorMode,
    selectedId,
    useCallback((entityId, signal) => listAdminFamilyServices(entityId, signal), [])
  );

  const [memberContactId, setMemberContactId] = useState('');

  const [removeTarget, setRemoveTarget] = useState<{ memberId: string; label: string } | null>(
    null
  );

  const selected = useMemo(
    () => rows.find((f) => f.id === selectedId) ?? null,
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
    stateKeyPrefix: 'family',
    pendingLocationId,
    setPendingLocationId,
    optimisticLocationSummary,
    setOptimisticLocationSummary,
    selectedLocationSummary: selected?.location_summary,
    locations,
    geographicAreas,
    refreshLocations,
  });

  const memberContactOptions = useMemo(() => {
    return contactOptions.filter((c) => {
      const row = contactsForMembership.find((x) => x.id === c.id);
      if (!row) {
        return true;
      }
      return contactEligibleForEntityMembership(row, selectedId, 'family');
    });
  }, [contactOptions, contactsForMembership, selectedId]);

  const primaryMemberLabel = useCallback((members: ApiSchemas['AdminFamilyMember'][]) => {
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
          'You saved an address to a new location but have not finished creating this family yet. Leave anyway? The location row stays in the directory.',
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
    setFamilyName('');
    setRelationshipType('prospect');
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
        await createFamily({
          family_name: familyName.trim(),
          relationship_type: relationshipType,
          location_id: loc,
          tag_ids: tagIds,
        });
        await resetCreateForm();
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
        is_primary_contact: false,
      });
      setMemberContactId('');
    } catch {
      // Retry preserved.
    }
  }

  async function handleDeleteFamily(
    row: ApiSchemas['AdminFamily'],
    clickEvent: MouseEvent<HTMLButtonElement>
  ): Promise<void> {
    clickEvent.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Delete family',
      description: `Permanently delete "${row.family_name}"? This removes the family from the database and cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setDeleteActionError('');
    try {
      await deleteFamily(row.id);
      if (selectedId === row.id) {
        await resetCreateForm();
      }
    } catch (err) {
      setDeleteActionError(err instanceof Error ? err.message : 'Failed to delete family');
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
    setRelationshipType(
      relationshipTypeForEditor(row.relationship_type, FAMILY_RELATIONSHIP_TYPES)
    );
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
        title='Family'
        description='Create a family or select one below. Add members by linking an existing contact.'
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
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
          <div className='lg:col-span-2'>
            <Label htmlFor='crm-family-name'>Family name</Label>
            <Input
              id='crm-family-name'
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='lg:col-span-1'>
            <Label htmlFor='crm-family-rel'>Relationship</Label>
            <Select
              id='crm-family-rel'
              value={relationshipType}
              onChange={(e) =>
                setRelationshipType(e.target.value as (typeof FAMILY_RELATIONSHIP_TYPES)[number])
              }
            >
              {FAMILY_RELATIONSHIP_TYPES.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          {editorMode === 'edit' ? (
            <div className='lg:col-span-1'>
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
          ) : (
            <div className='hidden lg:col-span-1 lg:block' aria-hidden />
          )}
          <div className='lg:col-span-4'>
            <EntityInlineLocationSection
              sectionId='crm-family-location'
              stateKey={inlineLocationStateKey}
              location={resolvedLocation}
              embeddedSummary={embeddedLocationSummary}
              areas={geographicAreas}
              areasLoading={areasLoading}
              isSaving={isSaving || locationSaveStatus.isSaving}
              isGeocoding={locationGeocoding}
              saveError={locationSaveStatus.error}
              onSaveCreate={saveNewLocation}
              onSaveUpdate={async (id, payload) => {
                await updateSharedLocation(id, payload);
              }}
              onClear={clearPendingLocation}
              onGeocode={geocodeLocation}
            />
          </div>
          <div className='lg:col-span-4 space-y-4'>
            <EntityTagPicker
              id='crm-family-tags'
              label='Tags'
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              disabled={isSaving}
              variant='collapsible'
            />
            <EntityServicesSection id='crm-family-services' labels={serviceLabels} />
          </div>
          {editorMode === 'edit' && selected ? (
            <div className='lg:col-span-4'>
              <EntityMembersSection
                sectionId='crm-family-members'
                contactSelectId='crm-family-member-contact'
                entityLabel='family'
                helpText='Role is stored on each membership and matches the contact type when the member is added or when the contact type is changed on the contact record.'
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
        title='Families'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error || deleteActionError}
        loadingLabel='Loading families...'
        onLoadMore={loadMore}
        toolbar={
          <AdminTableToolbar>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='crm-families-search'>Search</Label>
              <Input
                id='crm-families-search'
                value={filters.query}
                onChange={(e) => {
                  setDeleteActionError('');
                  setFilter('query', e.target.value);
                }}
                placeholder='Family name or member name / email'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-families-active'>Status</Label>
              <Select
                id='crm-families-active'
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
        <AdminDataTable tableClassName='min-w-[720px]'>
          <AdminDataTableHead>
            <tr>
              <AdminDataTableHeadCell>Name</AdminDataTableHeadCell>
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
                  {formatFamilyOrOrganizationPartyLabel(row.family_name, primaryLabel) || '—'}
                </AdminDataTableCell>
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
                        void handleDeleteFamily(row, e);
                      }}
                      disabled={isSaving}
                      aria-label='Delete family'
                      title='Delete family'
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
