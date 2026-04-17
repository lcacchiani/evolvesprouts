import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReferralLinkQrDialog } from '@/components/admin/services/referral-link-qr-dialog';

vi.mock('@/lib/config', () => ({
  getPublicSiteBaseUrl: () => 'https://www.example.com',
}));

const generateSpy = vi.fn(async () => 'data:image/png;base64,AA');

vi.mock('@/lib/qr-code-image', () => ({
  generateReferralQrPngDataUrl: (...args: unknown[]) => generateSpy(...args),
}));

describe('ReferralLinkQrDialog', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    generateSpy.mockClear();
  });

  it('shows URL preview and opened analytics when GTM is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADMIN_GTM_CONTAINER_ID', 'GTM-TEST');
    const pushSpy = vi.fn();
    const dataLayerStub: { push: typeof pushSpy } = { push: pushSpy };
    Object.defineProperty(window, 'dataLayer', {
      configurable: true,
      writable: true,
      value: dataLayerStub,
    });

    render(
      <ReferralLinkQrDialog
        open
        onClose={() => {}}
        discountCode='SAVE10'
        serviceSlug='my-best-auntie-training-course'
      />,
    );

    await vi.waitFor(() => {
      expect(
        screen.getByRole('link', {
          name: 'https://www.example.com/en/services/my-best-auntie-training-course?ref=SAVE10',
        }),
      ).toBeInTheDocument();
    });

    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin_referral_qr_opened',
        app_surface: 'admin',
        service_slug: 'my-best-auntie-training-course',
      }),
    );

    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument();
  });

  it('download uses createObjectURL', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    globalThis.fetch = vi.fn(async () => {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;

    render(
      <ReferralLinkQrDialog open onClose={() => {}} discountCode='ABC' serviceSlug={null} />,
    );

    await vi.waitFor(() => {
      expect(generateSpy).toHaveBeenCalled();
    });

    expect(generateSpy.mock.calls[0]?.[0]).toMatchObject({
      logoSrc: expect.stringMatching(/\/evolvesprouts-logo\.svg$/),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download PNG (512)' }));

    await vi.waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalled();
    });

    createObjectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('omits logo from QR generation when include-logo is unchecked', async () => {
    render(
      <ReferralLinkQrDialog open onClose={() => {}} discountCode='ABC' serviceSlug={null} />,
    );

    await vi.waitFor(() => {
      expect(generateSpy).toHaveBeenCalled();
    });

    generateSpy.mockClear();
    fireEvent.click(screen.getByRole('checkbox', { name: /include logo in qr code/i }));

    await vi.waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          logoSrc: '',
        }),
      );
    });
  });

  it('labels inner content for screen readers', async () => {
    render(
      <ReferralLinkQrDialog open onClose={() => {}} discountCode='SAVE10' serviceSlug={null} />,
    );
    await vi.waitFor(() => {
      expect(
        screen.getByLabelText('Referral link configuration and preview'),
      ).toBeInTheDocument();
    });
  });
});
