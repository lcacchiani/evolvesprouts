import { Card } from '@/components/ui/card';

export interface LeadsOverTimeProps {
  values: Array<{ period: string; count: number }>;
}

export function LeadsOverTime({ values }: LeadsOverTimeProps) {
  return (
    <Card title='Leads over time'>
      <div className='space-y-2'>
        {values.length === 0 ? (
          <p className='text-sm text-slate-600'>No trend data.</p>
        ) : (
          values.map((entry) => (
            <div key={entry.period} className='flex items-center justify-between rounded-md border border-slate-200 px-3 py-2'>
              <span className='text-sm text-slate-700'>{entry.period}</span>
              <span className='text-sm font-semibold text-slate-900'>{entry.count}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
