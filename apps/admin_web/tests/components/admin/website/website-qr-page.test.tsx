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

  it('does not append src until a valid slug value is entered', async () => {
    render(<WebsiteQrPage />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Append .*src.* query parameter/i }));

    await vi.waitFor(() => {
      expect(screen.getByRole('link', { name: 'https://www.example.com/en/' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('src value'), { target: { value: 'qr' } });

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

  it('uses page- prefixed download filename and prepends normalized src when set', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const createdAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: unknown) => {
      if (tag !== 'a') {
        return originalCreateElement(tag, options as DocumentCreateElementOptions | undefined);
      }
      const anchor = originalCreateElement('a', options as DocumentCreateElementOptions | undefined);
      createdAnchors.push(anchor);
      vi.spyOn(anchor, 'click').mockImplementation(() => {});
      return anchor;
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    }) as typeof fetch;

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<WebsiteQrPage />);

    await vi.waitFor(() => {
      expect(generateSpy).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download PNG (512)' }));
    await vi.waitFor(() => {
      expect(createdAnchors.at(-1)?.download).toBe('page-home-en-512.png');
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /Append .*src.* query parameter/i }));
    fireEvent.change(screen.getByLabelText('src value'), { target: { value: 'poster' } });

    await vi.waitFor(() => {
      expect(
        screen.getByRole('link', { name: 'https://www.example.com/en/?src=poster' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Download PNG (512)' }));
    await vi.waitFor(() => {
      expect(createdAnchors.at(-1)?.download).toBe('poster-page-home-en-512.png');
    });
  });
});
