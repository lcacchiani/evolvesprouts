'use client';

import { useCallback, useState } from 'react';

import { createLead, createLeadNote, updateLead } from '@/lib/leads-api';
import type { ContactSource, FunnelStage, LeadDetail, LeadType } from '@/types/leads';
import { toErrorMessage } from './hook-errors';

interface MutationOptions {
  onSuccess?: (leadId?: string) => Promise<void> | void;
}

export function useLeadMutations({ onSuccess }: MutationOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const createLeadEntry = useCallback(
    async (body: {
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
    }): Promise<LeadDetail | null> => {
      setIsLoading(true);
      setError('');
      try {
        const created = await createLead(body);
        await onSuccess?.(created?.id);
        return created;
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to create lead.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  const updateStage = useCallback(
    async (id: string, stage: FunnelStage, lostReason?: string): Promise<LeadDetail | null> => {
      setIsLoading(true);
      setError('');
      try {
        const updated = await updateLead(id, {
          funnel_stage: stage,
          lost_reason: lostReason ?? null,
        });
        await onSuccess?.(id);
        return updated;
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to update lead stage.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  const assignLead = useCallback(
    async (id: string, assignedTo: string | null): Promise<LeadDetail | null> => {
      setIsLoading(true);
      setError('');
      try {
        const updated = await updateLead(id, { assigned_to: assignedTo });
        await onSuccess?.(id);
        return updated;
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to assign lead.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  const addNote = useCallback(
    async (leadId: string, content: string) => {
      setIsLoading(true);
      setError('');
      try {
        await createLeadNote(leadId, { content });
        await onSuccess?.(leadId);
      } catch (err) {
        setError(toErrorMessage(err, 'Failed to add note.'));
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  return {
    isLoading,
    error,
    createLeadEntry,
    updateStage,
    assignLead,
    addNote,
  };
}
