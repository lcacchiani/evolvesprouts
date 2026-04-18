import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebsiteQrPage } from '@/components/admin/website/website-qr-page';

vi.mock('@/lib/config', () => ({
  getPublicSiteBaseUrl: () => 'https://www.example.com',
}));

const generateSpy = vi.fn(async () => 'data:image/png;base64,AA');

vi.mock('@/lib/qr-code-image', () => ({
  generatePublicSiteQrPngDataUrl: (...args: unknown[]) => generateSpy(...args),
}));

describe('WebsiteQrPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    generateSpy.mockClear();
  });

  it('shows locale-prefixed URL for default preset', async () => {
    render(<WebsiteQrPage />);

    await vi.waitFor(() => {
      expect(screen.getByRole('link', { name: 'https://www.example.com/en/' })).toBeInTheDocument();
    });
  });

  it('updates link when locale changes', async () => {
    render(<WebsiteQrPage />);

    await vi.waitFor(() => {
      expect(screen.getByRole('link', { name: 'https://www.example.com/en/' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Locale'), { target: { value: 'zh-HK' } });

    await vi.waitFor(() => {
      expect(screen.getByRole('link', { name: 'https://www.example.com/zh-HK/' })).toBeInTheDocument();
    });
  });

  it('shows custom path field and builds URL when custom is selected', async () => {
    render(<WebsiteQrPage />);

    fireEvent.change(screen.getByLabelText('Page'), { target: { value: '__custom__' } });

    expect(screen.getByLabelText('Custom path')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Custom path'), {
      target: { value: '/contact-us' },
    });

    await vi.waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'https://www.example.com/en/contact-us/' }),
      ).toBeInTheDocument();
    });
  });

  it('appends src query when enabled', async () => {
    render(<WebsiteQrPage />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Append .*src.* query parameter/i }));

    await vi.waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'https://www.example.com/en/?src=qr' }),
      ).toBeInTheDocument();
    });
  });

  it('updates src query value in preview URL', async () => {
    render(<WebsiteQrPage />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Append .*src.* query parameter/i }));

    fireEvent.change(screen.getByLabelText('src value'), {
      target: { value: 'poster' },
    });

    await vi.waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'https://www.example.com/en/?src=poster' }),
      ).toBeInTheDocument();
    });
  });
});
