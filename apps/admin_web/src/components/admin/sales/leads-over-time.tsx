'use client';

import { Card } from '@/components/ui/card';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface LeadsOverTimeProps {
  values: Array<{ period: string; count: number }>;
}

export function LeadsOverTime({ values }: LeadsOverTimeProps) {
  return (
    <Card title='Leads Over Time'>
      {values.length === 0 ? (
        <p className='text-sm text-slate-600'>No trend data.</p>
      ) : (
        <div className='h-72'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={values} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='period' />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area
                type='monotone'
                dataKey='count'
                stroke='#2563eb'
                fill='#93c5fd'
                fillOpacity={0.45}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
