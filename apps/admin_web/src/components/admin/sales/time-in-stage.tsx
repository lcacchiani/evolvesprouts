import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';

export interface TimeInStageProps {
  values: Record<string, number>;
}

export function TimeInStage({ values }: TimeInStageProps) {
  const entries = Object.entries(values);

  return (
    <Card title='Time in stage'>
      <div className='space-y-2'>
        {entries.length === 0 ? (
          <p className='text-sm text-slate-600'>No stage timing data.</p>
        ) : (
          entries.map(([stage, days]) => (
            <div key={stage} className='flex items-center justify-between rounded-md border border-slate-200 px-3 py-2'>
              <span className='text-sm text-slate-700'>{toTitleCase(stage)}</span>
              <span className='text-sm font-semibold text-slate-900'>{days.toFixed(1)} days</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
