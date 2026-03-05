'use client';

import { Card } from '@/components/ui/card';
import { toTitleCase } from '@/lib/format';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TimeInStageProps {
  values: Record<string, number>;
}

export function TimeInStage({ values }: TimeInStageProps) {
  const entries = Object.entries(values).map(([stage, days]) => ({
    stage,
    label: toTitleCase(stage),
    days,
  }));

  return (
    <Card title='Time in stage'>
      {entries.length === 0 ? (
        <p className='text-sm text-slate-600'>No stage timing data.</p>
      ) : (
        <div className='h-72'>
          <ResponsiveContainer width='100%' height='100%'>
            <BarChart data={entries} layout='vertical' margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis type='number' />
              <YAxis type='category' dataKey='label' width={120} />
              <Tooltip
                formatter={(value) => [`${Number(value ?? 0).toFixed(1)} days`, 'Average']}
              />
              <Bar dataKey='days' fill='#7c3aed' radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
