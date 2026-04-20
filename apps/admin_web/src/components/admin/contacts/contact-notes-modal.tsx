'use client';

import { useCallback, useEffect, useId, useState } from 'react';

import { useConfirmDialog } from '@/hooks/use-confirm-dialog';
import {
  ArchiveIcon,
  DeleteIcon,
  NoteIcon,
  PencilIcon,
  RestoreIcon,
} from '@/components/icons/action-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { StatusBanner } from '@/components/status-banner';
import { Textarea } from '@/components/ui/textarea';
import {
  createAdminContactNote,
  deleteAdminContactNote,
  listAdminContactNotes,
  updateAdminContactNote,
  type CrmNoteRow,
} from '@/lib/crm-api';
import type { components } from '@/types/generated/admin-api.generated';

type AdminContact = components['schemas']['AdminContact'];

export interface ContactNotesModalProps {
  open: boolean;
  contact: AdminContact | null;
  onClose: () => void;
  onStandaloneNoteCountChange: (contactId: string, count: number) => void;
}

function contactDisplayName(contact: AdminContact): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  return name || contact.email || contact.id;
}

export function ContactNotesModal({
  open,
  contact,
  onClose,
  onStandaloneNoteCountChange,
}: ContactNotesModalProps) {
  const newNoteFieldId = useId();
  const [notes, setNotes] = useState<CrmNoteRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [confirmDialogProps, requestConfirm] = useConfirmDialog();

  const refreshCount = useCallback(
    (next: CrmNoteRow[]) => {
      if (contact) {
        onStandaloneNoteCountChange(contact.id, next.length);
      }
    },
    [contact, onStandaloneNoteCountChange]
  );

  useEffect(() => {
    if (!open || !contact) {
      return;
    }
    let cancelled = false;
    setLoadError('');
    setActionError('');
    setNewContent('');
    setEditingId(null);
    setEditDraft('');
    setIsLoading(true);
    void (async () => {
      try {
        const rows = await listAdminContactNotes(contact.id);
        if (!cancelled) {
          setNotes(rows);
          refreshCount(rows);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load notes');
          setNotes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contact, refreshCount]);

  async function handleAddNote() {
    if (!contact?.id || !newContent.trim()) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      const created = await createAdminContactNote(contact.id, { content: newContent.trim() });
      if (created) {
        const next = [created, ...notes];
        setNotes(next);
        setNewContent('');
        refreshCount(next);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSaveEdit() {
    if (!contact?.id || !editingId || !editDraft.trim()) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      const updated = await updateAdminContactNote(contact.id, editingId, {
        content: editDraft.trim(),
      });
      if (updated) {
        const next = notes.map((n) => (n.id === updated.id ? updated : n));
        setNotes(next);
        setEditingId(null);
        setEditDraft('');
        refreshCount(next);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteNote(note: CrmNoteRow) {
    if (!contact?.id) {
      return;
    }
    const confirmed = await requestConfirm({
      title: 'Delete note',
      description: 'Permanently delete this note? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      await deleteAdminContactNote(contact.id, note.id);
      const next = notes.filter((n) => n.id !== note.id);
      setNotes(next);
      if (editingId === note.id) {
        setEditingId(null);
        setEditDraft('');
      }
      refreshCount(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setIsMutating(false);
    }
  }

  function startEdit(note: CrmNoteRow) {
    setEditingId(note.id);
    setEditDraft(note.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft('');
  }

  return (
    <>
      {open && contact ? (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4'
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <div className='w-full max-w-lg'>
            <Card
              title={`Notes · ${contactDisplayName(contact)}`}
              className='max-h-[min(90vh,640px)] space-y-4 overflow-y-auto'
            >
            <p className='text-sm text-slate-600'>
              Standalone contact notes. Notes attached to sales leads are managed on the lead
              detail screen.
            </p>
            {loadError ? (
              <StatusBanner variant='error' title='Could not load notes'>
                {loadError}
              </StatusBanner>
            ) : null}
            {actionError ? (
              <StatusBanner variant='error' title='Note action failed'>
                {actionError}
              </StatusBanner>
            ) : null}
            {isLoading ? (
              <p className='text-sm text-slate-600'>Loading notes…</p>
            ) : (
              <ul className='space-y-3'>
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className='rounded-md border border-slate-200 bg-slate-50/80 p-3'
                  >
                    {editingId === note.id ? (
                      <div className='space-y-2'>
                        <Label htmlFor={`edit-note-${note.id}`}>Edit note</Label>
                        <Textarea
                          id={`edit-note-${note.id}`}
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={4}
                          disabled={isMutating}
                        />
                        <div className='flex flex-wrap gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            disabled={isMutating || !editDraft.trim()}
                            onClick={() => void handleSaveEdit()}
                          >
                            Save
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='secondary'
                            disabled={isMutating}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className='whitespace-pre-wrap text-sm text-slate-900'>{note.content}</p>
                        <p className='mt-1 text-xs text-slate-500'>
                          {note.created_by}
                          {note.created_at ? ` · ${note.created_at}` : ''}
                        </p>
                        <div className='mt-2 flex justify-end gap-2'>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            className='h-8 min-w-8 px-0'
                            disabled={isMutating}
                            onClick={() => startEdit(note)}
                            aria-label='Edit note'
                            title='Edit note'
                          >
                            <PencilIcon className='h-4 w-4 shrink-0' aria-hidden />
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='danger'
                            className='h-8 min-w-8 px-0'
                            disabled={isMutating}
                            onClick={() => void handleDeleteNote(note)}
                            aria-label='Delete note'
                            title='Delete note'
                          >
                            <DeleteIcon className='h-4 w-4 shrink-0' aria-hidden />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className='space-y-2 border-t border-slate-200 pt-4'>
              <Label htmlFor={newNoteFieldId}>New note</Label>
              <Textarea
                id={newNoteFieldId}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                disabled={isLoading || isMutating}
                placeholder='Add a note about this contact…'
              />
              <Button
                type='button'
                size='sm'
                disabled={isLoading || isMutating || !newContent.trim()}
                onClick={() => void handleAddNote()}
              >
                Add note
              </Button>
            </div>
              <div className='flex justify-end border-t border-slate-200 pt-2'>
                <Button type='button' variant='secondary' onClick={onClose}>
                  Close
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
      <ConfirmDialog {...confirmDialogProps} />
    </>
  );
}
