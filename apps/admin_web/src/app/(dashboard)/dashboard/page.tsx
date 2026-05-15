import { DashboardPageBody } from '@/components/admin/dashboard/dashboard-page-body';

export default function DashboardRoutePage() {
  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-semibold text-slate-900'>Dashboard</h1>
      <DashboardPageBody />
    </div>
  );
}
