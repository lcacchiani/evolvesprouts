'use client';

import { useCallback, useMemo, useState } from 'react';

import { useAdminUsers } from './use-admin-users';
import { useDialogState } from './use-dialog-state';
import { useLeadAnalytics } from './use-lead-analytics';
import { useLeadDetail } from './use-lead-detail';
import { useLeadList } from './use-lead-list';
import { useLeadMutations } from './use-lead-mutations';

export type SalesView = 'pipeline' | 'analytics';

export function useSalesPage() {
  const [activeView, setActiveView] = useState<SalesView>('pipeline');
  const [selectedLeadIdState, setSelectedLeadIdState] = useState<string | null | undefined>(
    undefined
  );
  const [isCreateDialogOpen, openCreateDialog, closeCreateDialog] = useDialogState();

  const adminUsers = useAdminUsers();
  const leadList = useLeadList();

  const selectedLeadId = useMemo(() => {
    if (selectedLeadIdState !== undefined) {
      return selectedLeadIdState;
    }
    return leadList.leads[0]?.id ?? null;
  }, [leadList.leads, selectedLeadIdState]);

  const setSelectedLeadId = useCallback((leadId: string | null) => {
    setSelectedLeadIdState(leadId);
  }, []);

  const leadDetail = useLeadDetail(selectedLeadId);
  const leadAnalytics = useLeadAnalytics();

  const mutations = useLeadMutations({
    onSuccess: async (leadId) => {
      await leadList.refetch();
      if (leadId) {
        setSelectedLeadIdState(leadId);
      }
      await leadDetail.refetch();
      await leadAnalytics.refetch();
    },
  });

  const selectedLead = useMemo(
    () => leadList.leads.find((entry) => entry.id === selectedLeadId) ?? null,
    [leadList.leads, selectedLeadId]
  );

  return {
    activeView,
    setActiveView,
    selectedLeadId,
    setSelectedLeadId,
    selectedLead,
    isCreateDialogOpen,
    openCreateDialog,
    closeCreateDialog,
    adminUsers,
    leadList,
    leadDetail,
    leadAnalytics,
    mutations,
  };
}
