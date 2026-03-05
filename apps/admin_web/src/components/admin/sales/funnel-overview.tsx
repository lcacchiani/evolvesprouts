import { FunnelChart } from './funnel-chart';
import { KpiCards } from './kpi-cards';
import { SourceBreakdown } from './source-breakdown';

import type { FunnelStage, LeadAnalytics } from '@/types/leads';

export interface FunnelOverviewProps {
  analytics: LeadAnalytics | null;
  selectedStage: FunnelStage | null;
  onSelectStage: (stage: FunnelStage | null) => void;
}

const EMPTY_ANALYTICS: LeadAnalytics = {
  funnel: {},
  conversionRate: 0,
  avgDaysToConvert: null,
  leadsThisWeek: 0,
  leadsThisMonth: 0,
  sourceBreakdown: {},
  stageConversionRates: {},
  avgDaysInStage: {},
  leadsOverTime: [],
  assigneeStats: [],
};

export function FunnelOverview({ analytics, selectedStage, onSelectStage }: FunnelOverviewProps) {
  const data = analytics ?? EMPTY_ANALYTICS;
  const totalLeads = Object.values(data.funnel).reduce((accumulator, value) => accumulator + value, 0);

  return (
    <div className='space-y-4'>
      <KpiCards
        totalLeads={totalLeads}
        conversionRate={data.conversionRate}
        avgDaysToConvert={data.avgDaysToConvert}
        leadsThisWeek={data.leadsThisWeek}
      />
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <FunnelChart funnel={data.funnel} activeStage={selectedStage} onSelectStage={onSelectStage} />
        <SourceBreakdown sourceBreakdown={data.sourceBreakdown} />
      </div>
    </div>
  );
}
