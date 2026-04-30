import type { AuditLog } from '@/types/audit-log';

export function ActionBadge({ action }: { action: AuditLog['action'] }) {
  const colors: Record<AuditLog['action'], string> = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[action]}`}
    >
      {action}
    </span>
  );
}

export function SourceBadge({ source }: { source: AuditLog['source'] | string }) {
  const colors: Record<string, string> = {
    trigger: 'bg-slate-100 text-slate-700',
    application: 'bg-purple-100 text-purple-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[source] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {source}
    </span>
  );
}
