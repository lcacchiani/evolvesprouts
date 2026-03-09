import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RootErrorPage from '@/app/error';

const mockedUsePathname = vi.hoisted(() => vi.fn(() => '/en'));
const mockedReportInternalError = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  usePathname: mockedUsePathname,
}));
vi.mock('@/lib/internal-error-reporting', () => ({
  reportInternalError: mockedReportInternalError,
}));

describe('Root error boundary page', () => {
  afterEach(() => {
    mockedUsePathname.mockReset();
    mockedUsePathname.mockReturnValue('/en');
    mockedReportInternalError.mockReset();
  });

  it('uses pathname locale and invokes reset callback', () => {
    mockedUsePathname.mockReturnValue('/zh-CN/events');
    const resetSpy = vi.fn();
    const error = new Error('root boundary failure');

    render(<RootErrorPage error={error} reset={resetSpy} />);

    const retryButton = screen.getByRole('button', { name: '重试' });
    expect(retryButton).toBeInTheDocument();
    expect(mockedReportInternalError).toHaveBeenCalledWith({
      context: 'root-error-boundary',
      error,
      metadata: { locale: 'zh-CN' },
    });

    fireEvent.click(retryButton);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
