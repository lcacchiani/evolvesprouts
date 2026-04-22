'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';

import type { useAdminEntityContacts } from '@/hooks/use-admin-entity-contacts';
import { useGeocodeVenueAddress } from '@/hooks/use-geocode-venue-address';
import { useInlineLocationSave } from '@/hooks/use-inline-location-save';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { InlineLocationEditor } from '@/components/admin/locations/inline-location-editor';
import type { InlineLocationEmbeddedSummary } from '@/components/admin/locations/inline-location-editor';
import { ContactNotesModal } from '@/components/admin/contacts/contact-notes-modal';
import { EntityTagPicker } from '@/components/admin/contacts/entity-tag-picker';
import { ArchiveIcon, DeleteIcon, NoteIcon, RestoreIcon } from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  type EntityPickerListItem,
  getAdminContact,
  listEntityFamilyPicker,
  listEntityOrganizationPicker,
  searchEntityContactsForPicker,
  type EntityTagRef,
} from '@/lib/entity-api';
import { formatEntityVenueLocationLabel, formatEnumLabel } from '@/lib/format';
import type { EntityListFilters } from '@/types/entity-list';
import {
  CONTACT_RELATIONSHIP_TYPES,
  relationshipTypeForEditor,
} from '@/types/entity-relationship';
import type { AdminUser } from '@/types/leads';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';
import type { components } from '@/types/generated/admin-api.generated';

/** Shown after the contact name in the list when `family_ids` is non-empty. */
const CONTACT_NAME_FAMILY_EMOJI = '👨‍👩‍👧';
/** Shown after the contact name in the list when `organization_ids` is non-empty. */
const CONTACT_NAME_ORG_EMOJI = '🏢';

type ApiSchemas = components['schemas'];

const CONTACT_TYPES: ApiSchemas['EntityContactType'][] = [
  'parent',
  'child',
  'helper',
  'professional',
  'other',
];

function formatContactPickerLabel(c: ApiSchemas['AdminContact']): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name ? `${name}${c.email ? ` · ${c.email}` : ''}` : c.email || c.id;
}

const SOURCES: ApiSchemas['EntityContactSource'][] = [
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

function contactNameMembershipSuffix(row: ApiSchemas['AdminContact']): string {
  const parts: string[] = [];
  if (row.family_ids.length > 0) {
    parts.push(CONTACT_NAME_FAMILY_EMOJI);
  }
  if (row.organization_ids.length > 0) {
    parts.push(CONTACT_NAME_ORG_EMOJI);
  }
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
}

function linkedVenueReadOnlyLines(row: ApiSchemas['AdminContact']): {
  lines: string[];
  footerNote: string | null;
} {
  const lines: string[] = [];

  function pushLine(emoji: string, summary: ApiSchemas['EntityLocationVenueSummary'] | null) {
    if (!summary) {
      lines.push(`${emoji} Not set`);
      return;
    }
    lines.push(
      `${emoji} ${formatEntityVenueLocationLabel({
        id: summary.id,
        name: summary.name,
        address: summary.address,
        areaName: summary.area_name,
      })}`
    );
  }

  if (row.family_ids.length > 0) {
    pushLine(CONTACT_NAME_FAMILY_EMOJI, row.family_location_summary ?? null);
  }
  if (row.organization_ids.length > 0) {
    pushLine(CONTACT_NAME_ORG_EMOJI, row.organization_location_summary ?? null);
  }

  if (lines.length === 0) {
    return { lines: [], footerNote: null };
  }

  const footerNote =
    row.family_ids.length > 0 && row.organization_ids.length > 0
      ? 'Read-only. Edit addresses on the family and organisation records.'
      : row.family_ids.length > 0
        ? 'Read-only. Edit address on the family record.'
        : 'Read-only. Edit address on the organisation record.';

  return { lines, footerNote };
}

export interface ContactsPanelProps {
  contacts: ReturnType<typeof useAdminEntityContacts>;
  adminUsers: AdminUser[];
  onPatchStandaloneNoteCount: (contactId: string, standaloneNoteCount: number) => void;
  tags: EntityTagRef[];
  locations: LocationSummary[];
  geographicAreas: GeographicAreaSummary[];
  areasLoading: boolean;
  refreshLocations: () => Promise<void> | void;
}

export function ContactsPanel({
  contacts,
  adminUsers,
  onPatchStandaloneNoteCount,
  tags,
  locations,
  geographicAreas,
  areasLoading,
  refreshLocations,
}: ContactsPanelProps) {
  const {
    contacts: rows,
    filters,
    setFilter,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    isSaving,
    createContact,
    updateContact,
    deleteContact,
  } = contacts;

  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [deleteActionError, setDeleteActionError] = useState('');
  const [notesTarget, setNotesTarget] = useState<ApiSchemas['AdminContact'] | null>(null);

  const [familyPicker, setFamilyPicker] = useState<EntityPickerListItem[]>([]);
  const [organizationPicker, setOrganizationPicker] = useState<EntityPickerListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [families, orgs] = await Promise.all([
          listEntityFamilyPicker(),
          listEntityOrganizationPicker(),
        ]);
        if (!cancelled) {
          setFamilyPicker(Array.isArray(families) ? families : []);
          setOrganizationPicker(Array.isArray(orgs) ? orgs : []);
        }
      } catch {
        if (!cancelled) {
          setFamilyPicker([]);
          setOrganizationPicker([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [contactType, setContactType] = useState<ApiSchemas['EntityContactType']>('parent');
  const [relationshipType, setRelationshipType] =
    useState<(typeof CONTACT_RELATIONSHIP_TYPES)[number]>('prospect');
  const [source, setSource] = useState<ApiSchemas['EntityContactSource']>('manual');
  const [sourceDetail, setSourceDetail] = useState('');
  const [referralContactId, setReferralContactId] = useState('');
  const [referralSearchInput, setReferralSearchInput] = useState('');
  const [referralSearchResults, setReferralSearchResults] = useState<EntityPickerListItem[]>([]);
  const [referralPinnedLabel, setReferralPinnedLabel] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [pendingLocationId, setPendingLocationId] = useState<string | null>(null);
  const [optimisticLocationSummary, setOptimisticLocationSummary] =
    useState<InlineLocationEmbeddedSummary | null>(null);
  const [familySelectId, setFamilySelectId] = useState('');
  const [organizationSelectId, setOrganizationSelectId] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  const {
    status: locationSaveStatus,
    createSharedLocation,
    updateSharedLocation,
    clearError: clearLocationSaveError,
  } = useInlineLocationSave(refreshLocations);
  const { geocode: geocodeLocation, isGeocoding: locationGeocoding } = useGeocodeVenueAddress();

  const selected = useMemo(
    () => rows.find((c) => c.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const linkedToFamilyOrOrg = Boolean(familySelectId.trim() || organizationSelectId.trim());
  const locationFieldLocked = linkedToFamilyOrOrg;

  const readOnlyLockedLinesForEditor = useMemo(() => {
    if (!linkedToFamilyOrOrg || !selected) {
      return null;
    }
    const { lines, footerNote } = linkedVenueReadOnlyLines(selected);
    if (lines.length === 0) {
      return null;
    }
    return { lines, footerNote };
  }, [linkedToFamilyOrOrg, selected]);

  const inlineLocationStateKey =
    editorMode === 'create' ? 'contact-new' : `contact:${selectedId ?? 'none'}`;

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

  const referralSelectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of referralSearchResults) {
      byId.set(r.id, r.label);
    }
    const rid = referralContactId.trim();
    if (rid && referralPinnedLabel.trim() && !byId.has(rid)) {
      byId.set(rid, referralPinnedLabel.trim());
    }
    return Array.from(byId.entries()).map(([id, label]) => ({ id, label }));
  }, [referralSearchResults, referralContactId, referralPinnedLabel]);

  useEffect(() => {
    if (source !== 'referral') {
      queueMicrotask(() => {
        setReferralSearchResults([]);
      });
      return;
    }
    const q = referralSearchInput.trim();
    if (q.length < 2) {
      queueMicrotask(() => {
        setReferralSearchResults([]);
      });
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const items = await searchEntityContactsForPicker({
            query: q,
            excludeContactId: editorMode === 'edit' ? selectedId : null,
            limit: 50,
          });
          if (!cancelled) {
            setReferralSearchResults(Array.isArray(items) ? items : []);
          }
        } catch {
          if (!cancelled) {
            setReferralSearchResults([]);
          }
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [referralSearchInput, source, selectedId, editorMode]);

  useEffect(() => {
    if (source !== 'referral' || !referralContactId.trim()) {
      queueMicrotask(() => {
        setReferralPinnedLabel('');
      });
      return;
    }
    const id = referralContactId.trim();
    let cancelled = false;
    void (async () => {
      try {
        const c = await getAdminContact(id);
        if (cancelled || !c) {
          return;
        }
        setReferralPinnedLabel(formatContactPickerLabel(c));
      } catch {
        if (!cancelled) {
          setReferralPinnedLabel('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [referralContactId, source]);

  function resetCreateForm() {
    if (editorMode === 'create' && pendingLocationId && typeof window !== 'undefined') {
      const ok = window.confirm(
        'You saved an address to a new location but have not finished creating this contact yet. Leave anyway? The location row stays in the directory.'
      );
      if (!ok) {
        return;
      }
    }
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
    setReferralContactId('');
    setReferralSearchInput('');
    setReferralSearchResults([]);
    setReferralPinnedLabel('');
    setDateOfBirth('');
    setPendingLocationId(null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setFamilySelectId('');
    setOrganizationSelectId('');
    setTagIds([]);
    setActive(true);
  }

  async function handleSubmit(): Promise<void> {
    try {
      const dob = dateOfBirth.trim() ? dateOfBirth.trim() : null;
      const loc = pendingLocationId;
      const fam = familySelectId.trim();
      const org = organizationSelectId.trim();
      const family_ids = fam ? [fam] : [];
      const organization_ids = org ? [org] : [];

      if (source === 'referral' && !referralContactId.trim()) {
        return;
      }

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
          location_id: linkedToFamilyOrOrg ? null : loc,
          tag_ids: tagIds,
          family_ids,
          organization_ids,
          referral_contact_id:
            source === 'referral' ? referralContactId.trim() : null,
        });
        resetCreateForm();
        return;
      }
      if (!selected) {
        return;
      }
      const body: ApiSchemas['UpdateAdminContactRequest'] = {
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
        active,
        tag_ids: tagIds,
        family_ids,
        organization_ids,
      };
      if (source === 'referral') {
        body.referral_contact_id = referralContactId.trim();
      }
      if (!locationFieldLocked) {
        body.location_id = loc;
      }
      await updateContact(selected.id, body);
    } catch {
      // Retry with form state preserved.
    }
  }

  function contactRowLabel(row: ApiSchemas['AdminContact']): string {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    if (name) {
      return name;
    }
    if (row.email?.trim()) {
      return row.email.trim();
    }
    return row.id;
  }

  async function handleDeleteContact(
    row: ApiSchemas['AdminContact'],
    clickEvent: MouseEvent<HTMLButtonElement>
  ): Promise<void> {
    clickEvent.stopPropagation();
    const confirmed = await requestConfirm({
      title: 'Delete contact',
      description: `Permanently delete "${contactRowLabel(row)}"? This removes the contact from the database and cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setDeleteActionError('');
    try {
      await deleteContact(row.id);
      if (selectedId === row.id) {
        resetCreateForm();
      }
    } catch (err) {
      setDeleteActionError(err instanceof Error ? err.message : 'Failed to delete contact');
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
    setRelationshipType(relationshipTypeForEditor(row.relationship_type));
    setSource(row.source);
    setSourceDetail(row.source_detail ?? '');
    setReferralContactId(row.referral_contact_id ?? '');
    setReferralSearchInput('');
    setReferralSearchResults([]);
    setReferralPinnedLabel('');
    setDateOfBirth(row.date_of_birth ?? '');
    setPendingLocationId(row.location_id ?? null);
    setOptimisticLocationSummary(null);
    clearLocationSaveError();
    setFamilySelectId(row.family_ids[0] ?? '');
    setOrganizationSelectId(row.organization_ids[0] ?? '');
    setTagIds([...row.tag_ids]);
    setActive(row.active);
  }

  const saveDisabled =
    isSaving ||
    !firstName.trim() ||
    (source === 'referral' && !referralContactId.trim());

  return (
    <div className='space-y-6'>
      <ConfirmDialog {...confirmDialogProps} />
      <ContactNotesModal
        open={notesTarget !== null}
        contact={notesTarget}
        adminUsers={adminUsers}
        onClose={() => setNotesTarget(null)}
        onStandaloneNoteCountChange={onPatchStandaloneNoteCount}
      />
      <AdminEditorCard
        title='Contact'
        description='Create a contact or select a row below to edit. When this contact is linked to a family or organisation, set location on that record instead. Mailchimp sync status is read-only from the API.'
        actions={
          <>
            {editorMode === 'edit' ? (
              <Button type='button' variant='secondary' onClick={resetCreateForm} disabled={isSaving}>
                Cancel
              </Button>
            ) : null}
            <Button type='button' disabled={saveDisabled} onClick={() => void handleSubmit()}>
              {editorMode === 'create' ? 'Create contact' : 'Update contact'}
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
              <Label htmlFor='crm-contact-type'>Contact type</Label>
              <Select
                id='crm-contact-type'
                value={contactType}
                onChange={(e) => setContactType(e.target.value as ApiSchemas['EntityContactType'])}
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
                  setRelationshipType(e.target.value as (typeof CONTACT_RELATIONSHIP_TYPES)[number])
                }
              >
                {CONTACT_RELATIONSHIP_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {formatEnumLabel(v)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
          </div>

          <div className='space-y-4'>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-4 lg:items-end'>
              <div className='lg:col-span-1'>
                <Label htmlFor='crm-contact-source'>Source</Label>
                <Select
                  id='crm-contact-source'
                  value={source}
                  onChange={(e) => {
                    const v = e.target.value as ApiSchemas['EntityContactSource'];
                    setSource(v);
                    if (v !== 'referral') {
                      setReferralContactId('');
                      setReferralSearchInput('');
                      setReferralSearchResults([]);
                      setReferralPinnedLabel('');
                    } else {
                      setReferralSearchResults([]);
                    }
                  }}
                >
                  {SOURCES.map((v) => (
                    <option key={v} value={v}>
                      {formatEnumLabel(v)}
                    </option>
                  ))}
                </Select>
              </div>
              {source === 'referral' ? (
                <>
                  <div className='lg:col-span-1'>
                    <Label htmlFor='crm-contact-referral-search'>Find referring contact</Label>
                    <Input
                      id='crm-contact-referral-search'
                      value={referralSearchInput}
                      onChange={(e) => setReferralSearchInput(e.target.value)}
                      placeholder='Type at least 2 characters (name, email, phone, Instagram)'
                      autoComplete='off'
                    />
                  </div>
                  <div className='lg:col-span-1'>
                    <Label htmlFor='crm-contact-referral'>Referred by contact</Label>
                    <Select
                      id='crm-contact-referral'
                      value={referralContactId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setReferralContactId(v);
                        const picked = referralSelectOptions.find((o) => o.id === v);
                        if (picked) {
                          setReferralPinnedLabel(picked.label);
                        }
                      }}
                    >
                      <option value=''>Select contact</option>
                      {referralSelectOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : null}
            </div>
            <div>
              <Label htmlFor='crm-contact-source-detail'>Source detail</Label>
              <Textarea
                id='crm-contact-source-detail'
                value={sourceDetail}
                onChange={(e) => setSourceDetail(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className='rounded-md border border-slate-200 bg-slate-50/40 p-3'>
            <InlineLocationEditor
              stateKey={inlineLocationStateKey}
              location={resolvedLocation}
              embeddedSummary={embeddedLocationSummary}
              areas={geographicAreas}
              areasLoading={areasLoading}
              canModify={!linkedToFamilyOrOrg}
              readOnlyLockedLines={readOnlyLockedLinesForEditor}
              readOnlyNote={
                linkedToFamilyOrOrg
                  ? 'Location is managed on the linked family or organisation.'
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
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            <div>
              <Label htmlFor='crm-contact-family'>Family</Label>
              <Select
                id='crm-contact-family'
                value={familySelectId}
                onChange={(e) => {
                  const v = e.target.value;
                  setFamilySelectId(v);
                  if (v) {
                    setPendingLocationId(null);
                    setOptimisticLocationSummary(null);
                  }
                }}
              >
                <option value=''>None</option>
                {familyPicker.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor='crm-contact-org'>Organisation</Label>
              <Select
                id='crm-contact-org'
                value={organizationSelectId}
                onChange={(e) => {
                  const v = e.target.value;
                  setOrganizationSelectId(v);
                  if (v) {
                    setPendingLocationId(null);
                    setOptimisticLocationSummary(null);
                  }
                }}
              >
                <option value=''>None</option>
                {organizationPicker.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
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
          </div>

          <EntityTagPicker
            id='crm-contact-tags'
            label='Tags'
            tags={tags}
            selectedIds={tagIds}
            onChange={setTagIds}
            disabled={isSaving}
            variant='collapsible'
          />

          {editorMode === 'edit' && selected ? (
            <div className='text-sm text-slate-600'>
              <p>Mailchimp: {formatEnumLabel(selected.mailchimp_status)}</p>
            </div>
          ) : null}
        </div>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Contacts'
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        error={error || deleteActionError}
        loadingLabel='Loading contacts...'
        onLoadMore={loadMore}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='crm-contacts-search'>Search</Label>
              <Input
                id='crm-contacts-search'
                value={filters.query}
                onChange={(e) => {
                  setDeleteActionError('');
                  setFilter('query', e.target.value);
                }}
                placeholder='Name, email, phone, Instagram'
              />
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-contacts-type'>Type</Label>
              <Select
                id='crm-contacts-type'
                value={filters.contact_type}
                onChange={(e) => {
                  setDeleteActionError('');
                  setFilter('contact_type', e.target.value as EntityListFilters['contact_type']);
                }}
              >
                <option value=''>All</option>
                {CONTACT_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {formatEnumLabel(v)}
                  </option>
                ))}
              </Select>
            </div>
            <div className='min-w-[140px]'>
              <Label htmlFor='crm-contacts-active'>Status</Label>
              <Select
                id='crm-contacts-active'
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
        <AdminDataTable tableClassName='min-w-[960px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold'>Email</th>
              <th className='px-4 py-3 font-semibold'>Type</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {rows.map((row) => {
              const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || '—';
              const membershipSuffix = contactNameMembershipSuffix(row);
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer transition ${
                    selectedId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => selectRow(row)}
                >
                  <td className='px-4 py-3'>
                    {name}
                    {membershipSuffix ? (
                      <>
                        <span aria-hidden>{membershipSuffix}</span>
                        {row.family_ids.length > 0 ? (
                          <span className='sr-only'>, linked to a family</span>
                        ) : null}
                        {row.organization_ids.length > 0 ? (
                          <span className='sr-only'>, linked to an organisation</span>
                        ) : null}
                      </>
                    ) : null}
                  </td>
                  <td className='px-4 py-3'>{row.email ?? '—'}</td>
                  <td className='px-4 py-3'>{formatEnumLabel(row.contact_type)}</td>
                  <td className='px-4 py-3 text-right'>
                    <div className='flex flex-wrap justify-end gap-2'>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='relative h-8 min-w-8 overflow-visible px-0'
                        onClick={(e) => {
                          e.stopPropagation();
                          setNotesTarget(row);
                        }}
                        disabled={isSaving}
                        aria-label='Contact notes'
                        title='Contact notes'
                      >
                        <NoteIcon className='h-4 w-4 shrink-0' aria-hidden />
                        {row.standalone_note_count > 0 ? (
                          <span className='absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white'>
                            {row.standalone_note_count > 99 ? '99+' : row.standalone_note_count}
                          </span>
                        ) : null}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='h-8 min-w-8 px-0'
                        onClick={(e) => {
                          e.stopPropagation();
                          void updateContact(row.id, { active: !row.active });
                        }}
                        disabled={isSaving}
                        aria-label={row.active ? 'Archive contact' : 'Restore contact'}
                        title={row.active ? 'Archive' : 'Restore'}
                      >
                        {row.active ? (
                          <ArchiveIcon className='h-4 w-4 shrink-0' aria-hidden />
                        ) : (
                          <RestoreIcon className='h-4 w-4 shrink-0' aria-hidden />
                        )}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='danger'
                        className='h-8 min-w-8 px-0'
                        onClick={(e) => {
                          void handleDeleteContact(row, e);
                        }}
                        disabled={isSaving}
                        aria-label='Delete contact'
                        title='Delete contact'
                      >
                        <DeleteIcon className='h-4 w-4 shrink-0' aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
    </div>
  );
}
