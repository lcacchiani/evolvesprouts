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
    vi.restoreAllMocks();
    generateSpy.mockClear();
  });

  it('shows URL preview and copy triggers clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <ReferralLinkQrDialog open onClose={() => {}} discountCode='SAVE10' />,
    );

    await vi.waitFor(() => {
      expect(
        screen.getByText('https://www.example.com/en/services/my-best-auntie-training-course?ref=SAVE10'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith(
      'https://www.example.com/en/services/my-best-auntie-training-course?ref=SAVE10',
    );

    if (clipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('download uses createObjectURL', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    globalThis.fetch = vi.fn(async () => {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;

    render(
      <ReferralLinkQrDialog open onClose={() => {}} discountCode='ABC' />,
    );

    await vi.waitFor(() => {
      expect(generateSpy).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download PNG (512)' }));

    await vi.waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalled();
    });

    createObjectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
