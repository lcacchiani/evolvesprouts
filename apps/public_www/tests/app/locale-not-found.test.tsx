import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LocalizedNotFoundPage from '@/app/[locale]/not-found';

const mockedUseParams = vi.hoisted(() => vi.fn(() => ({ locale: 'en' })));

vi.mock('next/navigation', () => ({
  useParams: mockedUseParams,
}));
vi.mock('@/components/shared/placeholder-page-layout', () => ({
  PlaceholderPageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='placeholder-page-layout'>{children}</div>
  ),
}));

describe('Localized not-found page', () => {
  afterEach(() => {
    mockedUseParams.mockReset();
    mockedUseParams.mockReturnValue({ locale: 'en' });
  });

  it('renders Chinese whoops copy for zh-CN route params', () => {
    mockedUseParams.mockReturnValue({ locale: 'zh-CN' });

    render(<LocalizedNotFoundPage />);

    expect(screen.getByRole('heading', { name: '页面未找到' })).toBeInTheDocument();
  });

  it('falls back to English for unknown locale params', () => {
    mockedUseParams.mockReturnValue({ locale: 'fr' });

    render(<LocalizedNotFoundPage />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
