'use client';

import { useState } from 'react';

import { CONTACT_SOURCES, LEAD_TYPES } from '@/types/leads';
import type { AdminUser, ContactSource, LeadType } from '@/types/leads';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toTitleCase } from '@/lib/format';

export interface CreateLeadDialogProps {
  open: boolean;
  users: AdminUser[];
  isLoading: boolean;
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

export function CreateLeadDialog({ open, users, isLoading, onClose, onCreate }: CreateLeadDialogProps) {
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

  if (!open) {
    return null;
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className='w-full max-w-2xl'>
        <Card title='Create lead' className='space-y-3'>
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
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isLoading || firstName.trim().length === 0}
              onClick={async () => {
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
              }}
            >
              Create lead
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
