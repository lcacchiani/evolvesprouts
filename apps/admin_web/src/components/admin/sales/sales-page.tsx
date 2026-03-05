'use client';

import { AnalyticsView } from './analytics-view';
import { CreateLeadDialog } from './create-lead-dialog';
import { FunnelOverview } from './funnel-overview';
import { LeadDetailPanel } from './lead-detail-panel';
import { LeadsTable } from './leads-table';
import { SalesHeader } from './sales-header';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { useSalesPage } from '@/hooks/use-sales-page';

export function SalesPage() {
  const state = useSalesPage();
  const hasAnyError =
    state.adminUsers.error ||
    state.leadList.error ||
    state.leadDetail.error ||
    state.leadAnalytics.error ||
    state.mutations.error;

  return (
    <div className='space-y-4'>
      {hasAnyError ? (
        <StatusBanner variant='error' title='Sales'>
          {hasAnyError}
        </StatusBanner>
      ) : null}

      <div className='flex gap-2'>
        <Button
          type='button'
          variant={state.activeView === 'pipeline' ? 'secondary' : 'ghost'}
          onClick={() => state.setActiveView('pipeline')}
        >
          Pipeline
        </Button>
        <Button
          type='button'
          variant={state.activeView === 'analytics' ? 'secondary' : 'ghost'}
          onClick={() => state.setActiveView('analytics')}
        >
          Analytics
        </Button>
      </div>

      <SalesHeader
        activeView={state.activeView}
        dateRange={state.leadAnalytics.dateRange}
        filters={state.leadList.filters}
        onDateRangeChange={(range) => {
          state.leadAnalytics.setDateRange(range);
          state.leadList.setFilter('dateFrom', range.dateFrom);
          state.leadList.setFilter('dateTo', range.dateTo);
        }}
        onRefresh={async () => {
          await state.leadList.refetch();
          await state.leadDetail.refetch();
          await state.leadAnalytics.refetch();
          await state.adminUsers.refetch();
        }}
        onNewLead={state.openCreateDialog}
      />

      {state.activeView === 'pipeline' ? (
        <>
          <FunnelOverview
            analytics={state.leadAnalytics.analytics}
            selectedStage={state.leadList.filters.stage[0] ?? null}
            onSelectStage={(stage) => state.leadList.setFilter('stage', stage ? [stage] : [])}
          />
          <LeadsTable
            leads={state.leadList.leads}
            filters={state.leadList.filters}
            users={state.adminUsers.users}
            selectedLeadId={state.selectedLeadId}
            totalCount={state.leadList.totalCount}
            isLoading={state.leadList.isLoading}
            isLoadingMore={state.leadList.isLoadingMore}
            error={state.leadList.error}
            hasMore={state.leadList.hasMore}
            onLoadMore={state.leadList.loadMore}
            onSelectLead={state.setSelectedLeadId}
            onFilterChange={state.leadList.setFilter}
            onClearFilters={state.leadList.clearFilters}
            onBulkAssign={async (leadIds, assignedTo) => {
              for (const leadId of leadIds) {
                await state.mutations.assignLead(leadId, assignedTo);
              }
            }}
            onBulkStageChange={async (leadIds, stage) => {
              for (const leadId of leadIds) {
                await state.mutations.updateStage(leadId, stage);
              }
            }}
          />
          <LeadDetailPanel
            open={Boolean(state.selectedLeadId)}
            lead={state.leadDetail.lead}
            users={state.adminUsers.users}
            isLoading={state.mutations.isLoading || state.leadDetail.isLoading}
            onClose={() => state.setSelectedLeadId(null)}
            onUpdateStage={async (stage, lostReason) => {
              if (!state.selectedLeadId) {
                return;
              }
              await state.mutations.updateStage(state.selectedLeadId, stage, lostReason);
            }}
            onAddNote={async (content) => {
              if (!state.selectedLeadId) {
                return;
              }
              await state.mutations.addNote(state.selectedLeadId, content);
            }}
            onAssign={async (assignedTo) => {
              if (!state.selectedLeadId) {
                return;
              }
              await state.mutations.assignLead(state.selectedLeadId, assignedTo);
            }}
          />
        </>
      ) : (
        <AnalyticsView analytics={state.leadAnalytics.analytics} users={state.adminUsers.users} />
      )}

      <CreateLeadDialog
        open={state.isCreateDialogOpen}
        users={state.adminUsers.users}
        isLoading={state.mutations.isLoading}
        onClose={state.closeCreateDialog}
        onCreate={async (payload) => {
          await state.mutations.createLeadEntry(payload);
        }}
      />
    </div>
  );
}
