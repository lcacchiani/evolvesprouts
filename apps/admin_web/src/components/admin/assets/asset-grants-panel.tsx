'use client';

import { useMemo, useState, type FormEvent } from 'react';

import type { AdminAsset, AssetGrant, CreateAssetGrantInput } from '@/types/assets';

import { ACCESS_GRANT_TYPES } from '@/types/assets';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface AssetGrantsPanelProps {
  selectedAsset: AdminAsset | null;
  grants: AssetGrant[];
  isLoadingGrants: boolean;
  grantsError: string;
  grantMutationError: string;
  isSavingGrant: boolean;
  isDeletingGrantId: string | null;
  onCreateGrant: (assetId: string, input: CreateAssetGrantInput) => Promise<void>;
  onDeleteGrant: (assetId: string, grantId: string) => Promise<void>;
}

function toTitleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }
  return parsedDate.toLocaleString();
}

export function AssetGrantsPanel({
  selectedAsset,
  grants,
  isLoadingGrants,
  grantsError,
  grantMutationError,
  isSavingGrant,
  isDeletingGrantId,
  onCreateGrant,
  onDeleteGrant,
}: AssetGrantsPanelProps) {
  const [grantType, setGrantType] = useState<CreateAssetGrantInput['grantType']>(
    'all_authenticated'
  );
  const [granteeId, setGranteeId] = useState('');
  const [formError, setFormError] = useState('');

  const isGranteeRequired = useMemo(() => grantType !== 'all_authenticated', [grantType]);

  if (!selectedAsset) {
    return (
      <Card
        title='Access grants'
        description='Select an asset to review and manage access grants.'
      >
        <p className='text-sm text-slate-600'>
          Restricted assets rely on grants. Public assets can still include grants if needed.
        </p>
      </Card>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const normalizedGrantee = granteeId.trim();
    if (isGranteeRequired && !normalizedGrantee) {
      setFormError('Grantee ID is required for organization and user grants.');
      return;
    }

    await onCreateGrant(selectedAsset.id, {
      grantType,
      granteeId: isGranteeRequired ? normalizedGrantee : null,
    });
    setGranteeId('');
  };

  const handleDelete = async (grantId: string) => {
    const confirmed = window.confirm('Delete this grant? Access revocation is immediate for new URLs.');
    if (!confirmed) {
      return;
    }
    await onDeleteGrant(selectedAsset.id, grantId);
  };

  return (
    <Card
      title='Access grants'
      description={`Asset: ${selectedAsset.title} (${selectedAsset.visibility})`}
      className='space-y-4'
    >
      {grantsError ? (
        <StatusBanner variant='error' title='Grants'>
          {grantsError}
        </StatusBanner>
      ) : null}

      {grantMutationError ? (
        <StatusBanner variant='error' title='Grant update'>
          {grantMutationError}
        </StatusBanner>
      ) : null}

      {formError ? (
        <StatusBanner variant='error' title='Validation'>
          {formError}
        </StatusBanner>
      ) : null}

      <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-3 md:grid-cols-[200px_minmax(0,1fr)_auto]'>
        <div className='space-y-2'>
          <Label htmlFor='grant-type'>Grant type</Label>
          <Select
            id='grant-type'
            value={grantType}
            onChange={(event) =>
              setGrantType(event.target.value as CreateAssetGrantInput['grantType'])
            }
          >
            {ACCESS_GRANT_TYPES.map((type) => (
              <option key={type} value={type}>
                {toTitleCase(type)}
              </option>
            ))}
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='grantee-id'>
            Grantee ID {isGranteeRequired ? '(required)' : '(not required)'}
          </Label>
          <Input
            id='grantee-id'
            value={granteeId}
            onChange={(event) => setGranteeId(event.target.value)}
            placeholder={
              grantType === 'organization'
                ? 'Organization UUID'
                : grantType === 'user'
                  ? 'User sub'
                  : 'Leave empty for all_authenticated'
            }
          />
        </div>

        <div className='flex items-end'>
          <Button type='submit' disabled={isSavingGrant}>
            {isSavingGrant ? 'Adding...' : 'Add grant'}
          </Button>
        </div>
      </form>

      <div className='overflow-x-auto rounded-md border border-slate-200'>
        <table className='w-full min-w-[680px] divide-y divide-slate-200 text-left'>
          <thead className='bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-700'>
            <tr>
              <th className='px-4 py-3 font-semibold'>Type</th>
              <th className='px-4 py-3 font-semibold'>Grantee</th>
              <th className='px-4 py-3 font-semibold'>Granted by</th>
              <th className='px-4 py-3 font-semibold'>Created</th>
              <th className='px-4 py-3 font-semibold text-right'>Actions</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-200 bg-white text-sm'>
            {isLoadingGrants ? (
              <tr>
                <td className='px-4 py-8 text-slate-600' colSpan={5}>
                  Loading grants...
                </td>
              </tr>
            ) : grants.length === 0 ? (
              <tr>
                <td className='px-4 py-8 text-slate-600' colSpan={5}>
                  No grants configured for this asset.
                </td>
              </tr>
            ) : (
              grants.map((grant) => (
                <tr key={grant.id}>
                  <td className='px-4 py-3 text-slate-700'>{toTitleCase(grant.grantType)}</td>
                  <td className='px-4 py-3 text-slate-700'>{grant.granteeId || '—'}</td>
                  <td className='px-4 py-3 text-slate-700'>{grant.grantedBy || '—'}</td>
                  <td className='px-4 py-3 text-slate-700'>{formatDate(grant.createdAt)}</td>
                  <td className='px-4 py-3 text-right'>
                    <Button
                      type='button'
                      variant='ghost'
                      onClick={() => void handleDelete(grant.id)}
                      disabled={isDeletingGrantId === grant.id}
                    >
                      {isDeletingGrantId === grant.id ? 'Removing...' : 'Revoke'}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
