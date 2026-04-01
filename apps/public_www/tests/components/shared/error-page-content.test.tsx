import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorPageContent } from '@/components/shared/error-page-content';
import type { SiteContent } from '@/content';
import enContent from '@/content/en.json';

const mockedReportInternalError = vi.hoisted(() => vi.fn());

vi.mock('@/lib/internal-error-reporting', () => ({
  reportInternalError: mockedReportInternalError,
}));

describe('ErrorPageContent', () => {
  afterEach(() => {
    mockedReportInternalError.mockReset();
  });

  it('reports and renders retry for root context', () => {
    const resetSpy = vi.fn();
    const error = new Error('shared failure');

    render(
      <ErrorPageContent
        locale='en'
        content={enContent as SiteContent}
        error={error}
        reset={resetSpy}
        reportingContext='root-error-boundary'
      />,
    );

    expect(mockedReportInternalError).toHaveBeenCalledWith({
      context: 'root-error-boundary',
      error,
      metadata: { locale: 'en' },
    });
    const button = screen.getByRole('button', { name: enContent.whoops.retryLabel });
    fireEvent.click(button);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });
});
