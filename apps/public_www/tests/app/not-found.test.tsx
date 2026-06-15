import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NotFoundPage from '@/app/not-found';

vi.mock('@/components/shared/placeholder-page-layout', () => ({
  PlaceholderPageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='placeholder-page-layout'>{children}</div>
  ),
}));

describe('Root not-found page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves Traditional Chinese from navigator language after mount', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      pathname: '/missing-page',
    } as Location);
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'zh-HK',
    });
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['zh-HK'],
    });

    render(<NotFoundPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '頁面未找到' })).toBeInTheDocument();
    });
  });

  it('prefers locale from pathname over navigator language', async () => {
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      pathname: '/zh-CN/unknown-route',
    } as Location);
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'zh-HK',
    });

    render(<NotFoundPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '页面未找到' })).toBeInTheDocument();
    });
  });
});
