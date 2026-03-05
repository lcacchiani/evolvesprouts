'use client';

import { exportLeadsCsv } from '@/lib/leads-api';
import type { LeadListFilters } from '@/types/leads';

import { Button } from '@/components/ui/button';

export interface LeadExportButtonProps {
  filters: LeadListFilters;
}

export function LeadExportButton({ filters }: LeadExportButtonProps) {
  return (
    <Button
      type='button'
      variant='outline'
      onClick={async () => {
        const blob = await exportLeadsCsv(filters);
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
        anchor.click();
        URL.revokeObjectURL(downloadUrl);
      }}
    >
      Export CSV
    </Button>
  );
}
