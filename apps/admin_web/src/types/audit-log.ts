export const AUDITABLE_AUDIT_LOG_TABLES = [
  'assets',
  'asset_access_grants',
  'calendar_manual_blocks',
] as const;

export type AuditLogAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type AuditLogSource = 'trigger' | 'application';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditLogAction;
  user_id: string | null;
  request_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  timestamp: string;
  source: AuditLogSource | string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditLogsFilters {
  table?: string;
  record_id?: string;
  user_id?: string;
  action?: AuditLogAction;
  since?: string;
}
