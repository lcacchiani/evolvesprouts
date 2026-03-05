import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';

export interface SourceBreakdownProps {
  sourceBreakdown: Record<string, number>;
}

export function SourceBreakdown({ sourceBreakdown }: SourceBreakdownProps) {
  const entries = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <Card title='Source breakdown'>
      <div className='space-y-2'>
        {entries.length === 0 ? (
          <p className='text-sm text-slate-600'>No source data available.</p>
        ) : (
          entries.map(([source, count]) => (
            <div key={source} className='flex items-center justify-between rounded-md border border-slate-200 px-3 py-2'>
              <span className='text-sm text-slate-700'>{toTitleCase(source)}</span>
              <span className='text-sm font-semibold text-slate-900'>{count}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
