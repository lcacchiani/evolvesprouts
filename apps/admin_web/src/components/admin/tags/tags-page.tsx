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
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeleteIcon } from '@/components/icons/action-icons';
import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import { AdminApiError, readAdminApiErrorField } from '@/lib/api-admin-client';
import {
  createAdminTag,
  deleteOrArchiveAdminTag,
  listAdminTags,
  updateAdminTag,
  type AdminTagListFilter,
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
  const [listFilter, setListFilter] = useState<AdminTagListFilter>('active');
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [restoreBusyId, setRestoreBusyId] = useState<string | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState('');

  const selectedRow = useMemo(
    () => tags.find((row) => row.id === selectedTagId) ?? null,
    [tags, selectedTagId]
  );

  const filteredTags = useMemo(() => {
    const q = listSearchQuery.trim().toLowerCase();
    if (!q) {
      return tags;
    }
    return tags.filter((row) => row.name.toLowerCase().includes(q));
  }, [tags, listSearchQuery]);

  const loadTags = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const rows = await listAdminTags({ filter: listFilter });
      setTags(rows);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to load tags.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [listFilter]);

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

  const handleRestore = async (row: AdminTagRow) => {
    setRestoreBusyId(row.id);
    setError('');
    try {
      const updated = await updateAdminTag(row.id, { archived: false });
      await loadTags();
      if (updated && selectedTagId === row.id) {
        applyRowSelection(updated);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Restore failed.';
      setError(message);
    } finally {
      setRestoreBusyId(null);
    }
  };

  const handleArchiveRow = async (row: AdminTagRow) => {
    if (row.is_system || row.archived_at) {
      return;
    }
    const confirmed = await requestConfirm({
      title: 'Archive tag?',
      description: `“${row.name}” will be hidden from pickers but stay on existing records.`,
      confirmLabel: 'Archive',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setArchiveBusyId(row.id);
    setError('');
    try {
      const updated = await updateAdminTag(row.id, { archived: true });
      await loadTags();
      if (updated && selectedTagId === row.id) {
        applyRowSelection(updated);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Archive failed.';
      setError(message);
    } finally {
      setArchiveBusyId(null);
    }
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
    if (row.is_system || row.usage_count > 0) {
      return;
    }
    const confirmed = await requestConfirm({
      title: 'Remove tag?',
      description: `Permanently delete “${row.name}”? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setDeleteBusyId(row.id);
    setError('');
    try {
      const outcome = await deleteOrArchiveAdminTag(row.id);
      if (outcome.deleted && selectedTagId === row.id) {
        resetCreateForm();
      }
      if (!outcome.deleted && outcome.tag && selectedTagId === row.id) {
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

  const editorIsBusy =
    isSaving || Boolean(deleteBusyId) || Boolean(archiveBusyId) || Boolean(restoreBusyId);

  const isEditingSystemTag = editorMode === 'edit' && selectedRow?.is_system;
  const showRestoreInEditor =
    editorMode === 'edit' && selectedRow && Boolean(selectedRow.archived_at) && !selectedRow.is_system;

  return (
    <div className='space-y-6'>
      <AdminEditorCard
        title='Tag'
        description='Tags apply across contacts, families, organisations, services, instances, and assets. Archived tags stay on existing records but no longer appear in pickers. Use Archive or Restore in the table (or Restore in the editor) to change archive state. Tags in use cannot be deleted until usage is zero—archive them instead. System tags (expense_attachment, client_document) cannot be renamed, archived, or deleted.'
        actions={
          editorMode === 'edit' ? (
            <>
              {showRestoreInEditor ? (
                <Button
                  type='button'
                  variant='secondary'
                  disabled={editorIsBusy}
                  onClick={() => selectedRow && void handleRestore(selectedRow)}
                >
                  {restoreBusyId === selectedTagId ? 'Restoring…' : 'Restore'}
                </Button>
              ) : null}
              <Button type='button' variant='secondary' disabled={editorIsBusy} onClick={resetCreateForm}>
                Cancel
              </Button>
              <Button
                type='submit'
                form={EDITOR_FORM_ID}
                disabled={editorIsBusy || !name.trim()}
              >
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
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start'>
            <div className='min-w-0 flex-1'>
              <Label htmlFor='tag-name'>Name</Label>
              <Input
                id='tag-name'
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                required
                autoComplete='off'
                disabled={Boolean(isEditingSystemTag)}
              />
              {isEditingSystemTag ? (
                <p className='mt-1 text-sm text-slate-600'>This system-managed tag name cannot be changed.</p>
              ) : null}
            </div>
            <div className='min-w-0 flex-1 sm:max-w-[220px]'>
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
            <div className='min-w-[200px] flex-1'>
              <Label htmlFor='tags-list-search'>Search</Label>
              <Input
                id='tags-list-search'
                value={listSearchQuery}
                onChange={(event) => setListSearchQuery(event.target.value)}
                placeholder='Name'
                autoComplete='off'
              />
            </div>
            <div className='min-w-[160px]'>
              <Label htmlFor='tags-list-filter'>Status</Label>
              <Select
                id='tags-list-filter'
                value={listFilter}
                onChange={(event) => setListFilter(event.target.value as AdminTagListFilter)}
              >
                <option value='active'>Active</option>
                <option value='archived'>Archived</option>
                <option value='all'>All</option>
              </Select>
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
              <th className='px-4 py-3 text-right font-semibold'>Operations</th>
            </tr>
          </AdminDataTableHead>
          <AdminDataTableBody>
            {filteredTags.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer transition ${
                  selectedTagId === row.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
                onClick={() => applyRowSelection(row)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    applyRowSelection(row);
                  }
                }}
              >
                <td className='px-4 py-3 font-medium text-slate-900'>
                  {row.name}
                  {row.is_system ? (
                    <span className='ml-2 text-xs font-normal text-slate-500'>(system)</span>
                  ) : null}
                </td>
                <td className='px-4 py-3 font-mono text-sm text-slate-700'>{row.color ?? '—'}</td>
                <td className='px-4 py-3'>{row.usage_count}</td>
                <td className='px-4 py-3 text-sm text-slate-700'>
                  {row.archived_at ? 'Archived' : 'Active'}
                </td>
                <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}>
                  <div className='flex justify-end gap-1'>
                    {row.archived_at && !row.is_system ? (
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        disabled={editorIsBusy || restoreBusyId === row.id}
                        onClick={() => void handleRestore(row)}
                      >
                        {restoreBusyId === row.id ? '…' : 'Restore'}
                      </Button>
                    ) : null}
                    {!row.archived_at && !row.is_system ? (
                      <Button
                        type='button'
                        size='sm'
                        variant='secondary'
                        disabled={editorIsBusy || archiveBusyId === row.id}
                        onClick={() => void handleArchiveRow(row)}
                      >
                        {archiveBusyId === row.id ? '…' : 'Archive'}
                      </Button>
                    ) : null}
                    <Button
                      type='button'
                      size='sm'
                      variant='danger'
                      disabled={
                        editorIsBusy ||
                        deleteBusyId === row.id ||
                        row.is_system ||
                        row.usage_count > 0
                      }
                      onClick={() => void handleDeleteRow(row)}
                      aria-label={
                        row.is_system
                          ? 'System tag'
                          : row.usage_count > 0
                            ? 'Cannot delete tag while it is in use'
                            : 'Delete tag'
                      }
                      title={
                        row.is_system
                          ? 'System-managed tags cannot be removed'
                          : row.usage_count > 0
                            ? 'Remove all uses before deleting, or archive the tag'
                            : 'Delete tag'
                      }
                    >
                      <DeleteIcon className='h-4 w-4' />
                    </Button>
                  </div>
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
