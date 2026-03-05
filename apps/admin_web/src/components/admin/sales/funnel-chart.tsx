'use client';

import { FUNNEL_STAGES } from '@/types/leads';
import type { FunnelStage } from '@/types/leads';

import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';

import { getStageBadgeClass } from './stage-utils';

export interface FunnelChartProps {
  funnel: Record<string, number>;
  activeStage: FunnelStage | null;
  onSelectStage: (stage: FunnelStage | null) => void;
}

export function FunnelChart({ funnel, activeStage, onSelectStage }: FunnelChartProps) {
  const total = FUNNEL_STAGES.reduce((accumulator, stage) => accumulator + (funnel[stage] ?? 0), 0);

  return (
    <Card title='Funnel' className='space-y-3'>
      <div className='space-y-2'>
        {FUNNEL_STAGES.map((stage) => {
          const count = funnel[stage] ?? 0;
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
          const isActive = activeStage === stage;
          return (
            <button
              key={stage}
              type='button'
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                isActive ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
              onClick={() => onSelectStage(isActive ? null : stage)}
            >
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStageBadgeClass(stage)}`}
              >
                {toTitleCase(stage)}
              </span>
              <span className='text-sm text-slate-700'>
                {count} ({percentage}%)
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
