'use client';

import { useMemo, useState } from 'react';

import type { useAdminCrmOrganizations } from '@/hooks/use-admin-crm-organizations';
import { CrmTagPicker } from '@/components/admin/contacts/crm-tag-picker';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { formatCrmVenueLocationLabel, formatEnumLabel } from '@/lib/format';
import type { CrmTagRef } from '@/lib/crm-api';
import type { CrmListFilters } from '@/types/crm';
import {
  type CrmEntityRelationshipType,
  relationshipTypeForCrmEditor,
} from '@/types/crm-relationship';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

const ORG_TYPES: ApiSchemas['CrmOrganizationType'][] = [
  'school',
  'company',
  'community_group',
  'ngo',
  'other',
];

const ORG_ROLES: ApiSchemas['CrmOrganizationRole'][] = [
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
  organizations: ReturnType<typeof useAdminCrmOrganizations>;
  tags: CrmTagRef[];
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  contactOptions: { id: string; label: string }[];
  contactsForMembership: { id: string; family_ids: string[]; organization_ids: string[] }[];
}

export function OrganizationsPanel({
  organizations,
  tags,
  locations,
  geographicAreas,
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
    crmRelationshipOptions,
  } = organizations;

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [organizationType, setOrganizationType] =
    useState<ApiSchemas['CrmOrganizationType']>('company');
  const [relationshipType, setRelationshipType] = useState<CrmEntityRelationshipType>('prospect');
  const [slug, setSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [locationId, setLocationId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const [memberContactId, setMemberContactId] = useState('');
  const [memberRole, setMemberRole] = useState<ApiSchemas['CrmOrganizationRole']>('member');

  const [removeTarget, setRemoveTarget] = useState<{ memberId: string; label: string } | null>(
    null
  );

  const selected = useMemo(
    () => rows.find((o) => o.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const areaNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of geographicAreas) {
      map[a.id] = a.name;
    }
    return map;
  }, [geographicAreas]);

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
    setEditorMode('create');
    setSelectedId(null);
    setName('');
    setOrganizationType('company');
    setRelationshipType('prospect');
    setSlug('');
    setWebsite('');
    setLocationId('');
    setTagIds([]);
    setActive(true);
    setMemberContactId('');
    setMemberRole('member');
  }

  async function handleSubmit(): Promise<void> {
    try {
      const loc = locationId.trim() ? locationId.trim() : null;
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

  function selectRow(id: string) {
    const row = rows.find((o) => o.id === id);
    if (!row) {
      return;
    }
    setSelectedId(id);
    setEditorMode('edit');
    setName(row.name);
    setOrganizationType(row.organization_type);
    setRelationshipType(relationshipTypeForCrmEditor(row.relationship_type));
    setSlug(row.slug ?? '');
    setWebsite(row.website ?? '');
    setLocationId(row.location_id ?? '');
    setTagIds([...row.tag_ids]);
    setActive(row.active);
  }

  return (
    <div className='space-y-6'>
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
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div>
            <Label htmlFor='crm-org-name'>Name</Label>
            <Input
              id='crm-org-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-org-type'>Organisation type</Label>
            <Select
              id='crm-org-type'
              value={organizationType}
              onChange={(e) =>
                setOrganizationType(e.target.value as ApiSchemas['CrmOrganizationType'])
              }
            >
              {ORG_TYPES.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='crm-org-rel'>Relationship</Label>
            <Select
              id='crm-org-rel'
              value={relationshipType}
              onChange={(e) => {
                const next = e.target.value as CrmEntityRelationshipType;
                setRelationshipType(next);
                if (next !== 'partner') {
                  setSlug('');
                }
              }}
            >
              {crmRelationshipOptions.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          {relationshipType === 'partner' ? (
            <div>
              <Label htmlFor='crm-org-slug'>Slug</Label>
              <Input
                id='crm-org-slug'
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                autoComplete='off'
                placeholder='e.g. acme-partners'
              />
              <p className='mt-1 text-sm text-slate-600'>
                Lowercase letters, numbers, and hyphens only. Optional; must be unique among partner
                organisations.
              </p>
            </div>
          ) : null}
          <div>
            <Label htmlFor='crm-org-web'>Website</Label>
            <Input
              id='crm-org-web'
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-org-loc'>Location</Label>
            <Select
              id='crm-org-loc'
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value=''>None</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {formatCrmVenueLocationLabel({
                    id: loc.id,
                    name: loc.name,
                    address: loc.address,
                    areaName: areaNameById[loc.areaId] ?? '',
                  })}
                </option>
              ))}
            </Select>
            {editorMode === 'edit' && selected?.location_summary != null ? (
              <p className='mt-1 text-sm text-slate-600'>
                Current:{' '}
                {formatCrmVenueLocationLabel({
                  id: selected.location_summary.id,
                  name: selected.location_summary.name,
                  address: selected.location_summary.address,
                  areaName: selected.location_summary.area_name,
                })}
              </p>
            ) : null}
          </div>
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
          <div className='lg:col-span-2'>
            <CrmTagPicker
              id='crm-org-tags'
              label='Tags'
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              disabled={isSaving}
            />
          </div>
          {editorMode === 'edit' && selected ? (
            <div className='lg:col-span-2 space-y-3 rounded-md border border-slate-200 p-4'>
              <h3 className='text-sm font-semibold text-slate-800'>Members</h3>
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
                      setMemberRole(e.target.value as ApiSchemas['CrmOrganizationRole'])
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
          ) : null}
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Organisations'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading organisations...'
        onLoadMore={loadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='crm-orgs-search'>Search</Label>
              <Input
                id='crm-orgs-search'
                value={filters.query}
                onChange={(e) => setFilter('query', e.target.value)}
                placeholder='Organisation name'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-orgs-active'>Status</Label>
              <Select
                id='crm-orgs-active'
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
        <AdminDataTable tableClassName='min-w-[720px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold'>Type</th>
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
                <td className='px-4 py-3'>{row.name}</td>
                <td className='px-4 py-3'>{formatEnumLabel(row.organization_type)}</td>
                <td className='px-4 py-3'>{row.members.length}</td>
                <td className='px-4 py-3'>{row.active ? 'Active' : 'Archived'}</td>
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
