'use client';

import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ConversionFunnelProps {
  rates: Record<string, number>;
}

export function ConversionFunnel({ rates }: ConversionFunnelProps) {
  const entries = Object.entries(rates).map(([key, value]) => ({
    key,
    label: toTitleCase(key),
    percentage: value * 100,
  }));
  return (
    <Card title='Conversion funnel'>
      {entries.length === 0 ? (
        <p className='text-sm text-slate-600'>No conversion data.</p>
      ) : (
        <div className='h-72'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={entries} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='label' interval={0} angle={-15} textAnchor='end' height={70} />
              <YAxis unit='%' />
              <Tooltip
                formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, 'Rate']}
              />
              <Bar dataKey='percentage' fill='#10b981' radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
