import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';

export interface ConversionFunnelProps {
  rates: Record<string, number>;
}

export function ConversionFunnel({ rates }: ConversionFunnelProps) {
  const entries = Object.entries(rates);
  return (
    <Card title='Conversion funnel'>
      <div className='space-y-2'>
        {entries.length === 0 ? (
          <p className='text-sm text-slate-600'>No conversion data.</p>
        ) : (
          entries.map(([key, value]) => (
            <div key={key} className='flex items-center justify-between rounded-md border border-slate-200 px-3 py-2'>
              <span className='text-sm text-slate-700'>{toTitleCase(key)}</span>
              <span className='text-sm font-semibold text-slate-900'>{(value * 100).toFixed(1)}%</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
