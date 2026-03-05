'use client';

import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface SourceBreakdownProps {
  sourceBreakdown: Record<string, number>;
}

export function SourceBreakdown({ sourceBreakdown }: SourceBreakdownProps) {
  const entries = Object.entries(sourceBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([source, count]) => ({
      source,
      label: toTitleCase(source),
      count,
    }));

  return (
    <Card title='Source breakdown'>
      {entries.length === 0 ? (
        <p className='text-sm text-slate-600'>No source data available.</p>
      ) : (
        <div className='h-72'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={entries} layout='vertical' margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis type='number' />
              <YAxis type='category' dataKey='label' width={120} />
              <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, 'Leads']} />
              <Bar dataKey='count' fill='#64748b' radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
