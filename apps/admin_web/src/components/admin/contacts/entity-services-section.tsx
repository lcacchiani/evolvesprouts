'use client';

import { AdminCollapsibleSection } from '@/components/ui/admin-collapsible-section';

export interface EntityServicesSectionProps {
  id: string;
  labels: string[];
}

export function EntityServicesSection({ id, labels }: EntityServicesSectionProps) {
  if (labels.length === 0) {
    return null;
  }

  return (
    <AdminCollapsibleSection id={id} title='Services'>
      <ul className='space-y-1 pt-1 text-sm text-slate-700'>
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </AdminCollapsibleSection>
  );
}
