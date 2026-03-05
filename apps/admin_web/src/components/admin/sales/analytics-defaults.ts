import type { LeadAnalytics } from '@/types/leads';

export const EMPTY_ANALYTICS: LeadAnalytics = {
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
