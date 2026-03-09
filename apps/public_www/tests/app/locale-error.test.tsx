import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LocaleErrorPage from '@/app/[locale]/error';

const mockedUseParams = vi.hoisted(() => vi.fn(() => ({ locale: 'en' })));
const mockedReportInternalError = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useParams: mockedUseParams,
}));
vi.mock('@/lib/internal-error-reporting', () => ({
  reportInternalError: mockedReportInternalError,
}));

describe('Locale error boundary page', () => {
  afterEach(() => {
    mockedUseParams.mockReset();
    mockedUseParams.mockReturnValue({ locale: 'en' });
    mockedReportInternalError.mockReset();
  });

  it('renders localized retry label and invokes reset', () => {
    mockedUseParams.mockReturnValue({ locale: 'zh-HK' });
    const resetSpy = vi.fn();
    const error = new Error('locale boundary failure');

    render(<LocaleErrorPage error={error} reset={resetSpy} />);

    const retryButton = screen.getByRole('button', { name: '重試' });
    expect(retryButton).toBeInTheDocument();
    expect(mockedReportInternalError).toHaveBeenCalledWith({
      context: 'locale-error-boundary',
      error,
      metadata: { locale: 'zh-HK' },
    });

    fireEvent.click(retryButton);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to English labels for unknown locale params', () => {
    mockedUseParams.mockReturnValue({ locale: 'fr' });

    render(<LocaleErrorPage error={new Error('fallback')} reset={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
