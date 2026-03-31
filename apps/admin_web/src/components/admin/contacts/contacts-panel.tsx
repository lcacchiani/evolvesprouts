'use client';

import { useMemo, useState } from 'react';

import type { useAdminCrmContacts } from '@/hooks/use-admin-crm-contacts';
import { CrmTagPicker } from '@/components/admin/contacts/crm-tag-picker';
import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel, formatLocationLabel } from '@/lib/format';
import type { CrmTagRef } from '@/lib/crm-api';
import type { CrmListFilters } from '@/types/crm';
import {
  CRM_ENTITY_RELATIONSHIP_TYPES,
  relationshipTypeForCrmEditor,
} from '@/types/crm-relationship';
import type { LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

const CONTACT_TYPES: ApiSchemas['CrmContactType'][] = [
  'parent',
  'child',
  'helper',
  'professional',
  'other',
];

const SOURCES: ApiSchemas['CrmContactSource'][] = [
  'free_guide',
  'newsletter',
  'contact_form',
  'reservation',
  'referral',
  'instagram',
  'whatsapp',
  'linkedin',
  'event',
  'phone_call',
  'public_website',
  'manual',
];

export interface ContactsPanelProps {
  contacts: ReturnType<typeof useAdminCrmContacts>;
  tags: CrmTagRef[];
  locations: LocationSummary[];
}

export function ContactsPanel({ contacts, tags, locations }: ContactsPanelProps) {
  const {
    contacts: rows,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    totalCount,
    isSaving,
    createContact,
    updateContact,
  } = contacts;

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [contactType, setContactType] = useState<ApiSchemas['CrmContactType']>('parent');
  const [relationshipType, setRelationshipType] =
    useState<(typeof CRM_ENTITY_RELATIONSHIP_TYPES)[number]>('prospect');
  const [source, setSource] = useState<ApiSchemas['CrmContactSource']>('manual');
  const [sourceDetail, setSourceDetail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [locationId, setLocationId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const selected = useMemo(
    () => rows.find((c) => c.id === selectedId) ?? null,
    [rows, selectedId]
  );

  function resetCreateForm() {
    setEditorMode('create');
    setSelectedId(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setInstagramHandle('');
    setPhone('');
    setContactType('parent');
    setRelationshipType('prospect');
    setSource('manual');
    setSourceDetail('');
    setDateOfBirth('');
    setLocationId('');
    setTagIds([]);
    setActive(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const dob = dateOfBirth.trim() ? dateOfBirth.trim() : null;
      const loc = locationId.trim() ? locationId.trim() : null;
      if (editorMode === 'create') {
        await createContact({
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          instagram_handle: instagramHandle.trim() || null,
          phone: phone.trim() || null,
          contact_type: contactType,
          relationship_type: relationshipType,
          source,
          source_detail: sourceDetail.trim() || null,
          date_of_birth: dob,
          location_id: loc,
          tag_ids: tagIds,
        });
        resetCreateForm();
        return;
      }
      if (!selected) {
        return;
      }
      await updateContact(selected.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
        phone: phone.trim() || null,
        contact_type: contactType,
        relationship_type: relationshipType,
        source,
        source_detail: sourceDetail.trim() || null,
        date_of_birth: dob,
        location_id: loc,
        active,
        tag_ids: tagIds,
      });
    } catch {
      // Retry with form state preserved.
    }
  }

  function selectRow(row: ApiSchemas['AdminContact']) {
    setSelectedId(row.id);
    setEditorMode('edit');
    setFirstName(row.first_name);
    setLastName(row.last_name ?? '');
    setEmail(row.email ?? '');
    setInstagramHandle(row.instagram_handle ?? '');
    setPhone(row.phone ?? '');
    setContactType(row.contact_type);
    setRelationshipType(relationshipTypeForCrmEditor(row.relationship_type));
    setSource(row.source);
    setSourceDetail(row.source_detail ?? '');
    setDateOfBirth(row.date_of_birth ?? '');
    setLocationId(row.location_id ?? '');
    setTagIds([...row.tag_ids]);
    setActive(row.active);
  }

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Contact'
        description='Create a contact or select a row below to edit. Relationship excludes vendor (vendors are organisation records under Finance). Mailchimp sync status is read-only from the API.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button
              type='button'
              disabled={isSaving || !firstName.trim()}
              onClick={() => void handleSubmit()}
            >
              {editorMode === 'create' ? 'Create contact' : 'Update contact'}
            </Button>
          </>
        }
      >
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
          <div>
            <Label htmlFor='crm-contact-first'>First name</Label>
            <Input
              id='crm-contact-first'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-contact-last'>Last name</Label>
            <Input
              id='crm-contact-last'
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-contact-email'>Email</Label>
            <Input
              id='crm-contact-email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-contact-phone'>Phone</Label>
            <Input
              id='crm-contact-phone'
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-contact-ig'>Instagram</Label>
            <Input
              id='crm-contact-ig'
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='crm-contact-dob'>Date of birth</Label>
            <Input
              id='crm-contact-dob'
              type='date'
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor='crm-contact-type'>Contact type</Label>
            <Select
              id='crm-contact-type'
              value={contactType}
              onChange={(e) => setContactType(e.target.value as ApiSchemas['CrmContactType'])}
            >
              {CONTACT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='crm-contact-rel'>Relationship</Label>
            <Select
              id='crm-contact-rel'
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
          <div>
            <Label htmlFor='crm-contact-source'>Source</Label>
            <Select
              id='crm-contact-source'
              value={source}
              onChange={(e) => setSource(e.target.value as ApiSchemas['CrmContactSource'])}
            >
              {SOURCES.map((v) => (
                <option key={v} value={v}>
                  {formatEnumLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor='crm-contact-loc'>Location</Label>
            <Select
              id='crm-contact-loc'
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value=''>None</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {formatLocationLabel(loc)}
                </option>
              ))}
            </Select>
          </div>
          {editorMode === 'edit' ? (
            <div>
              <Label htmlFor='crm-contact-active'>Status</Label>
              <Select
                id='crm-contact-active'
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
              >
                <option value='true'>Active</option>
                <option value='false'>Archived</option>
              </Select>
            </div>
          ) : null}
          <div className='lg:col-span-2'>
            <Label htmlFor='crm-contact-source-detail'>Source detail</Label>
            <Textarea
              id='crm-contact-source-detail'
              value={sourceDetail}
              onChange={(e) => setSourceDetail(e.target.value)}
              rows={2}
            />
          </div>
          <div className='lg:col-span-2'>
            <CrmTagPicker
              id='crm-contact-tags'
              label='Tags'
              tags={tags}
              selectedIds={tagIds}
              onChange={setTagIds}
              disabled={isSaving}
            />
          </div>
          {editorMode === 'edit' && selected ? (
            <div className='lg:col-span-2 text-sm text-slate-600'>
              <p>
                Mailchimp: {formatEnumLabel(selected.mailchimp_status)} · Families:{' '}
                {selected.family_ids.length} · Organisations: {selected.organization_ids.length}
              </p>
            </div>
          ) : null}
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Contacts'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error}
        loadingLabel='Loading contacts...'
        onLoadMore={loadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='crm-contacts-search'>Search</Label>
              <Input
                id='crm-contacts-search'
                value={filters.query}
                onChange={(e) => setFilter('query', e.target.value)}
                placeholder='Name, email, phone, Instagram'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-contacts-active'>Status</Label>
              <Select
                id='crm-contacts-active'
                value={filters.active}
                onChange={(e) => setFilter('active', e.target.value as CrmListFilters['active'])}
              >
                <option value=''>All</option>
                <option value='true'>Active</option>
                <option value='false'>Archived</option>
              </Select>
            </div>
            <p className='text-sm text-slate-600' aria-live='polite'>
              {totalCount} total
            </p>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[960px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold'>Email</th>
              <th className='px-4 py-3 font-semibold'>Type</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {rows.map((row) => {
              const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || '—';
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer transition ${
                    selectedId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => selectRow(row)}
                >
                  <td className='px-4 py-3'>{name}</td>
                  <td className='px-4 py-3'>{row.email ?? '—'}</td>
                  <td className='px-4 py-3'>{formatEnumLabel(row.contact_type)}</td>
                  <td className='px-4 py-3'>{row.active ? 'Active' : 'Archived'}</td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
    </div>
  );
}
