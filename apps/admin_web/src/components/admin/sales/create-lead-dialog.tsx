'use client';

import { useState } from 'react';

import { CONTACT_SOURCES, LEAD_TYPES } from '@/types/leads';
import type { AdminUser, ContactSource, LeadType } from '@/types/leads';

import { StatusBanner } from '@/components/status-banner';
import { FormDialog } from '@/components/ui/form-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toTitleCase } from '@/lib/format';

export interface CreateLeadDialogProps {
  open: boolean;
  users: AdminUser[];
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    instagram_handle?: string | null;
    source: ContactSource;
    source_detail?: string | null;
    lead_type: LeadType;
    contact_type?: string | null;
    assigned_to?: string | null;
    note?: string | null;
  }) => Promise<void> | void;
}

export function CreateLeadDialog({
  open,
  users,
  isLoading,
  error,
  onClose,
  onCreate,
}: CreateLeadDialogProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [source, setSource] = useState<ContactSource>('manual');
  const [sourceDetail, setSourceDetail] = useState('');
  const [leadType, setLeadType] = useState<LeadType>('consultation');
  const [contactType, setContactType] = useState('parent');
  const [assignedTo, setAssignedTo] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    try {
      await onCreate({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
        source,
        source_detail: sourceDetail.trim() || null,
        lead_type: leadType,
        contact_type: contactType || null,
        assigned_to: assignedTo || null,
        note: note.trim() || null,
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setInstagramHandle('');
      setSource('manual');
      setSourceDetail('');
      setLeadType('consultation');
      setContactType('parent');
      setAssignedTo('');
      setNote('');
      onClose();
    } catch {
      // Keep dialog open so the user can correct and retry.
    }
  };

  return (
    <FormDialog
      open={open}
      title='Create Lead'
      isLoading={isLoading}
      error=''
      submitLabel='Create lead'
      submitDisabled={firstName.trim().length === 0}
      onClose={onClose}
      onSubmit={handleSubmit}
    >
      {error ? (
        <StatusBanner variant='error' title='Create Lead'>
          {error}
        </StatusBanner>
      ) : null}
      <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
        <Input
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder='First name *'
        />
        <Input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder='Last name' />
        <Input value={email} onChange={(event) => setEmail(event.target.value)} type='email' placeholder='Email' />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} type='tel' placeholder='Phone' />
        <Input
          value={instagramHandle}
          onChange={(event) => setInstagramHandle(event.target.value)}
          placeholder='Instagram handle'
        />
        <Select value={source} onChange={(event) => setSource(event.target.value as ContactSource)}>
          {CONTACT_SOURCES.map((sourceOption) => (
            <option key={sourceOption} value={sourceOption}>
              {toTitleCase(sourceOption)}
            </option>
          ))}
        </Select>
        <Input
          value={sourceDetail}
          onChange={(event) => setSourceDetail(event.target.value)}
          placeholder='Source detail'
        />
        <Select value={leadType} onChange={(event) => setLeadType(event.target.value as LeadType)}>
          {LEAD_TYPES.map((leadTypeOption) => (
            <option key={leadTypeOption} value={leadTypeOption}>
              {toTitleCase(leadTypeOption)}
            </option>
          ))}
        </Select>
        <Select value={contactType} onChange={(event) => setContactType(event.target.value)}>
          <option value='parent'>Parent</option>
          <option value='child'>Child</option>
          <option value='helper'>Helper</option>
          <option value='professional'>Professional</option>
          <option value='other'>Other</option>
        </Select>
        <Select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
          <option value=''>Unassigned</option>
          {users.map((user) => (
            <option key={user.sub} value={user.sub}>
              {user.name || user.email || user.sub}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder='Initial note'
        rows={3}
      />
    </FormDialog>
  );
}
