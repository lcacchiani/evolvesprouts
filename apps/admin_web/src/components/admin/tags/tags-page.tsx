'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { AdminDataTable, AdminDataTableBody, AdminDataTableHead } from '@/components/ui/admin-data-table';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaginatedTableCard } from '@/components/ui/paginated-table-card';
import { Textarea } from '@/components/ui/textarea';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { AdminApiError, readAdminApiErrorField } from '@/lib/api-admin-client';
import { formatDate } from '@/lib/format';
import {
  createAdminTag,
  deleteOrArchiveAdminTag,
  listAdminTags,
  updateAdminTag,
  type AdminTagRow,
} from '@/lib/tags-api';

import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

const EDITOR_FORM_ID = 'tags-editor-form';

export function TagsPage() {
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();
  const [tags, setTags] = useState<AdminTagRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const rows = await listAdminTags({ includeArchived: showArchived });
      setTags(rows);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load tags.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const resetCreateForm = () => {
    setEditorMode('create');
    setSelectedTagId(null);
    setName('');
    setColor('');
    setDescription('');
    setSaveError('');
  };

  const applyRowSelection = (row: AdminTagRow) => {
    setEditorMode('edit');
    setSelectedTagId(row.id);
    setName(row.name);
    setColor(row.color?.trim() ?? '');
    setDescription(row.description?.trim() ?? '');
    setSaveError('');
  };

  const parseColorPayload = (): string | null => {
    const trimmed = color.trim();
    return trimmed === '' ? null : trimmed;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError('');
    setIsSaving(true);
    try {
      const colorPayload = parseColorPayload();
      const descTrimmed = description.trim();
      if (editorMode === 'create') {
        const body: ApiSchemas['CreateAdminTagRequest'] = {
          name: name.trim(),
          color: colorPayload,
          description: descTrimmed === '' ? null : descTrimmed,
        };
        await createAdminTag(body);
        resetCreateForm();
        await loadTags();
        return;
      }
      if (!selectedTagId) {
        return;
      }
      const body: ApiSchemas['UpdateAdminTagRequest'] = {
        name: name.trim(),
        color: colorPayload,
        description: descTrimmed === '' ? null : descTrimmed,
      };
      await updateAdminTag(selectedTagId, body);
      await loadTags();
    } catch (caught) {
      if (caught instanceof AdminApiError && readAdminApiErrorField(caught) === 'name') {
        setSaveError('A tag with this name already exists.');
        return;
      }
      const message = caught instanceof Error ? caught.message : 'Save failed.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRow = async (row: AdminTagRow) => {
    const inUse = row.usage_count > 0;
    const confirmed = await requestConfirm(
      inUse
        ? {
            title: 'Archive tag?',
            description: `“${row.name}” is linked to ${row.usage_count} record(s). It will be hidden from pickers but stay on existing records.`,
            confirmLabel: 'Archive',
            variant: 'danger',
          }
        : {
            title: 'Remove tag?',
            description: `Permanently delete “${row.name}”? This cannot be undone.`,
            confirmLabel: 'Delete',
            variant: 'danger',
          }
    );
    if (!confirmed) {
      return;
    }
    setDeleteBusyId(row.id);
    setError('');
    try {
      const outcome = await deleteOrArchiveAdminTag(row.id);
      if (outcome.status === 204 && selectedTagId === row.id) {
        resetCreateForm();
      }
      if (outcome.status === 200 && selectedTagId === row.id) {
        applyRowSelection(outcome.tag);
      }
      await loadTags();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Delete failed.';
      setError(message);
    } finally {
      setDeleteBusyId(null);
    }
  };

  const editorIsBusy = isSaving || Boolean(deleteBusyId);

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title={editorMode === 'create' ? 'New tag' : 'Edit tag'}
        description='Tags apply across contacts, families, organisations, services, instances, and assets. Archived tags stay on existing records but no longer appear in pickers.'
        actions={
          editorMode === 'edit' ? (
            <>
              <Button type='button' variant='outline' disabled={editorIsBusy} onClick={resetCreateForm}>
                Cancel
              </Button>
              <Button type='submit' form={EDITOR_FORM_ID} disabled={editorIsBusy || !name.trim()}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <Button type='submit' form={EDITOR_FORM_ID} disabled={editorIsBusy || !name.trim()}>
              {isSaving ? 'Creating…' : 'Create tag'}
            </Button>
          )
        }
      >
        <form id={EDITOR_FORM_ID} className='space-y-4' onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <Label htmlFor='tag-name'>Name</Label>
            <Input
              id='tag-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='tag-color'>Color (#RRGGBB)</Label>
            <Input
              id='tag-color'
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder='#336699'
              maxLength={7}
              autoComplete='off'
            />
          </div>
          <div>
            <Label htmlFor='tag-description'>Description</Label>
            <Textarea
              id='tag-description'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={255}
            />
          </div>
          {saveError ? <p className='text-sm text-red-600'>{saveError}</p> : null}
        </form>
      </AdminEditorCard>

      <PaginatedTableCard
        title='Tags'
        isLoading={isLoading}
        isLoadingMore={false}
        hasMore={false}
        error={error}
        loadingLabel='Loading tags…'
        onLoadMore={() => {}}
        toolbar={
          <div className='mb-3 flex flex-wrap items-end gap-3'>
            <div className='flex min-w-[180px] items-center gap-2 pt-6'>
              <input
                id='tags-show-archived'
                type='checkbox'
                className='h-4 w-4 rounded border-slate-300 text-slate-900'
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              <Label htmlFor='tags-show-archived' className='cursor-pointer font-normal'>
                Show archived
              </Label>
            </div>
          </div>
        }
      >
        <AdminDataTable tableClassName='min-w-[720px]'>
          <AdminDataTableHead>
            <tr>
              <th className='px-4 py-3 font-semibold'>Name</th>
              <th className='px-4 py-3 font-semibold'>Color</th>
              <th className='px-4 py-3 font-semibold'>Uses</th>
              <th className='px-4 py-3 font-semibold'>Status</th>
              <th className='px-4 py-3 font-semibold'>Archived</th>
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {tags.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer transition ${
                  selectedTagId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => applyRowSelection(row)}
              >
                <td className='px-4 py-3 font-medium text-slate-900'>{row.name}</td>
                <td className='px-4 py-3 font-mono text-sm text-slate-700'>{row.color ?? '—'}</td>
                <td className='px-4 py-3'>{row.usage_count}</td>
                <td className='px-4 py-3 text-sm text-slate-700'>
                  {row.archived_at ? 'Archived' : 'Active'}
                </td>
                <td className='px-4 py-3 text-sm text-slate-600'>
                  {row.archived_at ? formatDate(row.archived_at) : '—'}
                </td>
                <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                  <Button
                    type='button'
                    size='sm'
                    variant='danger'
                    disabled={editorIsBusy || deleteBusyId === row.id}
                    onClick={() => void handleDeleteRow(row)}
                    aria-label={row.usage_count > 0 ? 'Archive tag' : 'Delete tag'}
                    title={row.usage_count > 0 ? 'Archive tag' : 'Delete tag'}
                  >
                    <DeleteIcon className='h-4 w-4' />
                  </Button>
                </td>
              </tr>
            ))}
          </AdminDataTableBody>
        </AdminDataTable>
      </PaginatedTableCard>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
