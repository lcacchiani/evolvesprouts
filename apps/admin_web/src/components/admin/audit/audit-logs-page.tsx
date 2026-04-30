'use client';

import { AuditLogsPanel } from '@/components/admin/audit/audit-logs-panel';
import { AUDITABLE_AUDIT_LOG_TABLES } from '@/types/audit-log';

export function AuditLogsPage() {
  return (
    <div className='space-y-6'>
      <AuditLogsPanel auditableTables={AUDITABLE_AUDIT_LOG_TABLES} />
    </div>
  );
}
