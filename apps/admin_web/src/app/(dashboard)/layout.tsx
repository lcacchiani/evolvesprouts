import type { ReactNode } from 'react';

import { AdminAuthenticatedShell } from '@/components/admin-authenticated-shell';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AdminAuthenticatedShell>{children}</AdminAuthenticatedShell>;
}
