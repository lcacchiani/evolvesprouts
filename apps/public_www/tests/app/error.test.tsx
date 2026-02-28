import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RootErrorPage from '@/app/error';

const mockedUsePathname = vi.hoisted(() => vi.fn(() => '/en'));

vi.mock('next/navigation', () => ({
  usePathname: mockedUsePathname,
}));

describe('Root error boundary page', () => {
  afterEach(() => {
    mockedUsePathname.mockReset();
    mockedUsePathname.mockReturnValue('/en');
    vi.restoreAllMocks();
  });

  it('uses pathname locale and invokes reset callback', () => {
    mockedUsePathname.mockReturnValue('/zh-CN/events');
    const resetSpy = vi.fn();
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('root boundary failure');

    render(<RootErrorPage error={error} reset={resetSpy} />);

    const retryButton = screen.getByRole('button', { name: '重试' });
    expect(retryButton).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[root-error-boundary:zh-CN]',
      error,
    );

    fireEvent.click(retryButton);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
