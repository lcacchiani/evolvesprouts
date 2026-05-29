'use client';

import { CertificatesPanel } from '@/components/admin/services/certificates-panel';
import { useCompletionCertificates } from '@/hooks/use-completion-certificates';
import type { ServiceSummary } from '@/types/services';

export interface CertificatesTabProps {
  serviceOptions: ServiceSummary[];
}

export function CertificatesTab({ serviceOptions }: CertificatesTabProps) {
  const certificates = useCompletionCertificates();
  return (
    <CertificatesPanel certificates={certificates} serviceOptions={serviceOptions} />
  );
}
