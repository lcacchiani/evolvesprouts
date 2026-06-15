import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { useCompletionCertificates } from '@/hooks/use-completion-certificates';
import type { ServiceSummary } from '@/types/services';

const mockLoadForService = vi.fn();
vi.mock('@/hooks/use-service-instance-options', () => ({
  useServiceInstanceOptions: () => ({
    instances: [],
    isLoading: false,
    error: '',
    loadForService: mockLoadForService,
  }),
}));

vi.mock('@/lib/services-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services-api')>();
  return {
    ...actual,
    listEnrollments: vi.fn().mockResolvedValue([]),
    isAbortRequestError: () => false,
  };
});

vi.mock('@/lib/completion-certificates-api', () => ({
  previewCompletionCertificatePdf: vi.fn().mockResolvedValue({ downloadUrl: '' }),
  getCompletionCertificatePdfDownload: vi.fn(),
}));

vi.mock('@/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => [
    {
      open: false,
      title: '',
      description: '',
      onConfirm: () => {},
      onCancel: () => {},
    },
    () => Promise.resolve(true),
  ],
}));

import { CertificatesPanel } from '@/components/admin/services/certificates-panel';

function buildCertificatesHook(
  overrides: Partial<ReturnType<typeof useCompletionCertificates>> = {}
): ReturnType<typeof useCompletionCertificates> {
  return {
    certificates: [],
    filters: { contactId: '', serviceId: '', instanceId: '', status: '' },
    setFilter: vi.fn(),
    isLoading: false,
    isLoadingMore: false,
    isSaving: false,
    error: '',
    hasMore: false,
    loadMore: vi.fn(),
    issueCertificate: vi.fn(),
    voidCertificate: vi.fn(),
    deleteCertificate: vi.fn(),
    refetch: vi.fn(),
    totalCount: 0,
    ...overrides,
  };
}

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

describe('CertificatesPanel', () => {
  it('renders editor and certificate table headers', () => {
    render(
      <CertificatesPanel
        certificates={buildCertificatesHook()}
        serviceOptions={serviceOptions}
      />
    );

    expect(screen.getByRole('heading', { name: 'Issue certificate' })).toBeInTheDocument();
    expect(screen.getByText('Recipient')).toBeInTheDocument();
    expect(screen.getByText('Program')).toBeInTheDocument();
  });

  it('shows list error from hook', () => {
    render(
      <CertificatesPanel
        certificates={buildCertificatesHook({ error: 'Failed to load certificates' })}
        serviceOptions={serviceOptions}
      />
    );
    expect(screen.getAllByText('Failed to load certificates').length).toBeGreaterThan(0);
  });
});
