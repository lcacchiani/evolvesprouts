'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import type { components } from '@/types/generated/admin-api.generated';
import { ENROLLMENT_STATUSES } from '@/types/services';

type ApiSchemas = components['schemas'];

export interface CreateEnrollmentDialogProps {
  open: boolean;
  isLoading: boolean;
  error: string;
  onClose: () => void;
  onCreate: (payload: ApiSchemas['CreateEnrollmentRequest']) => Promise<void> | void;
}

export function CreateEnrollmentDialog({
  open,
  isLoading,
  error,
  onClose,
  onCreate,
}: CreateEnrollmentDialogProps) {
  const [contactId, setContactId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [status, setStatus] = useState<ApiSchemas['EnrollmentStatus']>('registered');
  const [amountPaid, setAmountPaid] = useState('');
  const [currency, setCurrency] = useState('HKD');
  const [notes, setNotes] = useState('');

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
      <div className='w-full max-w-xl'>
        <Card title='Create enrollment' className='space-y-3'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <div>
              <Label htmlFor='enrollment-contact-id'>Contact ID</Label>
              <Input id='enrollment-contact-id' value={contactId} onChange={(event) => setContactId(event.target.value)} />
            </div>
            <div>
              <Label htmlFor='enrollment-family-id'>Family ID</Label>
              <Input id='enrollment-family-id' value={familyId} onChange={(event) => setFamilyId(event.target.value)} />
            </div>
            <div>
              <Label htmlFor='enrollment-organization-id'>Organization ID</Label>
              <Input
                id='enrollment-organization-id'
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              />
            </div>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            <div>
              <Label htmlFor='enrollment-status'>Status</Label>
              <Select
                id='enrollment-status'
                value={status}
                onChange={(event) => setStatus(event.target.value as ApiSchemas['EnrollmentStatus'])}
              >
                {ENROLLMENT_STATUSES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor='enrollment-amount'>Amount paid</Label>
              <Input id='enrollment-amount' value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
            </div>
            <div>
              <Label htmlFor='enrollment-currency'>Currency</Label>
              <Input
                id='enrollment-currency'
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </div>
          </div>
          <div>
            <Label htmlFor='enrollment-notes'>Notes</Label>
            <Textarea id='enrollment-notes' value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
          </div>
          {error ? <p className='text-sm text-red-600'>{error}</p> : null}
          <div className='flex justify-end gap-2'>
            <Button type='button' variant='secondary' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isLoading || (!contactId && !familyId && !organizationId)}
              onClick={async () => {
                await onCreate({
                  contact_id: contactId || null,
                  family_id: familyId || null,
                  organization_id: organizationId || null,
                  status,
                  amount_paid: amountPaid || null,
                  currency: currency || null,
                  notes: notes || null,
                });
              }}
            >
              {isLoading ? 'Creating...' : 'Create enrollment'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
