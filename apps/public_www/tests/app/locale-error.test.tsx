import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LocaleErrorPage from '@/app/[locale]/error';

const mockedUseParams = vi.hoisted(() => vi.fn(() => ({ locale: 'en' })));

vi.mock('next/navigation', () => ({
  useParams: mockedUseParams,
}));

describe('Locale error boundary page', () => {
  afterEach(() => {
    mockedUseParams.mockReset();
    mockedUseParams.mockReturnValue({ locale: 'en' });
    vi.restoreAllMocks();
  });

  it('renders localized retry label and invokes reset', () => {
    mockedUseParams.mockReturnValue({ locale: 'zh-HK' });
    const resetSpy = vi.fn();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('locale boundary failure');

    render(<LocaleErrorPage error={error} reset={resetSpy} />);

    const retryButton = screen.getByRole('button', { name: '重試' });
    expect(retryButton).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[locale-error-boundary:zh-HK]',
      error,
    );

    fireEvent.click(retryButton);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to English labels for unknown locale params', () => {
    mockedUseParams.mockReturnValue({ locale: 'fr' });

    render(<LocaleErrorPage error={new Error('fallback')} reset={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
