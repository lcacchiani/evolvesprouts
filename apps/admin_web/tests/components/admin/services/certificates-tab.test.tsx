import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CertificatesTab } from '@/components/admin/services/certificates-tab';
import type { ServiceSummary } from '@/types/services';

vi.mock('@/components/admin/services/certificates-panel', () => ({
  CertificatesPanel: ({ serviceOptions }: { serviceOptions: ServiceSummary[] }) => (
    <div data-testid='certificates-panel'>{serviceOptions.length} services</div>
  ),
}));

const serviceOptions: ServiceSummary[] = [
  {
    id: 'svc-1',
    instancesCount: 0,
    title: 'My Best Auntie',
    serviceKey: 'mba',
    serviceType: 'training_course',
    status: 'published',
    deliveryMode: 'in_person',
    locationId: null,
    coverImageS3Key: null,
    bookingSystem: null,
    serviceTier: null,
    description: null,
    createdBy: 'admin',
    createdAt: null,
    updatedAt: null,
    trainingDetails: null,
    eventDetails: null,
    consultationDetails: null,
  },
];

describe('CertificatesTab', () => {
  it('renders CertificatesPanel with service options', () => {
    render(<CertificatesTab serviceOptions={serviceOptions} />);
    expect(screen.getByTestId('certificates-panel')).toHaveTextContent('1 services');
  });
});
