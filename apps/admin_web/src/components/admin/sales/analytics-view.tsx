import { AssigneeLeaderboard } from './assignee-leaderboard';
import { EMPTY_ANALYTICS } from './analytics-defaults';
import { ConversionFunnel } from './conversion-funnel';
import { LeadsOverTime } from './leads-over-time';
import { TimeInStage } from './time-in-stage';

import type { AdminUser, LeadAnalytics } from '@/types/leads';

export interface AnalyticsViewProps {
  analytics: LeadAnalytics | null;
  users: AdminUser[];
}

export function AnalyticsView({ analytics, users }: AnalyticsViewProps) {
  const data = analytics ?? EMPTY_ANALYTICS;
  return (
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
      <ConversionFunnel rates={data.stageConversionRates} />
      <LeadsOverTime values={data.leadsOverTime} />
      <TimeInStage values={data.avgDaysInStage} />
      <AssigneeLeaderboard users={users} values={data.assigneeStats} />
    </div>
  );
}
