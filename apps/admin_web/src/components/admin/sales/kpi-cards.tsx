import { Card } from '@/components/ui/card';

export interface KpiCardsProps {
  totalLeads: number;
  conversionRate: number;
  avgDaysToConvert: number | null;
  leadsThisWeek: number;
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function KpiCards({
  totalLeads,
  conversionRate,
  avgDaysToConvert,
  leadsThisWeek,
}: KpiCardsProps) {
  const values = [
    { title: 'Total leads', value: `${totalLeads}`, subtitle: 'in selected period' },
    { title: 'Conversion rate', value: formatPercentage(conversionRate), subtitle: 'converted / total' },
    {
      title: 'Avg. days to convert',
      value: avgDaysToConvert?.toFixed(1) ?? '—',
      subtitle: 'from new to converted',
    },
    { title: 'New this week', value: `${leadsThisWeek}`, subtitle: 'new leads this week' },
  ];
  return (
    <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
      {values.map((item) => (
        <Card key={item.title} className='space-y-1'>
          <p className='text-xs uppercase tracking-[0.08em] text-slate-500'>{item.title}</p>
          <p className='text-2xl font-semibold text-slate-900'>{item.value}</p>
          <p className='text-xs text-slate-600'>{item.subtitle}</p>
        </Card>
      ))}
    </div>
  );
}
