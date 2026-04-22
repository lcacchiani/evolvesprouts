'use client';

import { useCallback } from 'react';

import { createLead, createLeadNote, updateLead } from '@/lib/leads-api';
import type { ContactSource, FunnelStage, LeadDetail, LeadType } from '@/types/leads';

import { useMutationRunner } from './use-mutation-runner';

interface MutationOptions {
  onSuccess?: (leadId?: string) => Promise<void> | void;
}

export function useLeadMutations({ onSuccess }: MutationOptions = {}) {
  const { isLoading, error, runWithState } = useMutationRunner('Failed to save lead changes.');

  const createLeadEntry = useCallback(
    async (body: {
      first_name: string;
      last_name?: string | null;
      email?: string | null;
      phone_region?: string | null;
      phone_number?: string | null;
      instagram_handle?: string | null;
      source: ContactSource;
      source_detail?: string | null;
      lead_type: LeadType;
      contact_type?: string | null;
      assigned_to?: string | null;
      note?: string | null;
    }): Promise<LeadDetail | null> =>
      runWithState(async () => {
        const created = await createLead(body);
        await onSuccess?.(created?.id);
        return created;
      }),
    [onSuccess, runWithState]
  );

  const updateStage = useCallback(
    async (id: string, stage: FunnelStage, lostReason?: string): Promise<LeadDetail | null> =>
      runWithState(async () => {
        const updated = await updateLead(id, {
          funnel_stage: stage,
          lost_reason: lostReason ?? null,
        });
        await onSuccess?.(id);
        return updated;
      }),
    [onSuccess, runWithState]
  );

  const assignLead = useCallback(
    async (id: string, assignedTo: string | null): Promise<LeadDetail | null> =>
      runWithState(async () => {
        const updated = await updateLead(id, { assigned_to: assignedTo });
        await onSuccess?.(id);
        return updated;
      }),
    [onSuccess, runWithState]
  );

  const addNote = useCallback(
    async (leadId: string, content: string) =>
      runWithState(async () => {
        await createLeadNote(leadId, { content });
        await onSuccess?.(leadId);
      }),
    [onSuccess, runWithState]
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
