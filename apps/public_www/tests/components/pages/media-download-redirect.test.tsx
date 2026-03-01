import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSearchParams } from 'next/navigation';

import { MediaDownloadRedirectPage } from '@/components/pages/media-download-redirect';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

const mockedUseSearchParams = vi.mocked(useSearchParams);
const originalAssetShareBaseUrl = process.env.NEXT_PUBLIC_ASSET_SHARE_BASE_URL;

function mockToken(tokenValue: string | null) {
  mockedUseSearchParams.mockReturnValue({
    get: (key: string) => (key === 'token' ? tokenValue : null),
  } as unknown as ReturnType<typeof useSearchParams>);
}

describe('MediaDownloadRedirectPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    if (originalAssetShareBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_ASSET_SHARE_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_ASSET_SHARE_BASE_URL = originalAssetShareBaseUrl;
    }
  });

  it('shows invalid-token state when token format is invalid', () => {
    process.env.NEXT_PUBLIC_ASSET_SHARE_BASE_URL = 'https://media.evolvesprouts.com';
    mockToken('invalid');

    render(<MediaDownloadRedirectPage />);

    expect(screen.getByText('Invalid download link')).toBeInTheDocument();
  });

  it('shows unavailable state when asset share base URL is missing', () => {
    delete process.env.NEXT_PUBLIC_ASSET_SHARE_BASE_URL;
    mockToken('A'.repeat(24));

    render(<MediaDownloadRedirectPage />);

    expect(
      screen.getByText('Download temporarily unavailable'),
    ).toBeInTheDocument();
  });

  it('renders preparing state with manual fallback link for valid token', () => {
    const token = 'A'.repeat(24);
    process.env.NEXT_PUBLIC_ASSET_SHARE_BASE_URL = 'https://media.evolvesprouts.com';
    mockToken(token);

    render(<MediaDownloadRedirectPage />);

    expect(screen.getByText('Preparing your download...')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download the media manually' })).toHaveAttribute(
      'href',
      `https://media.evolvesprouts.com/v1/assets/share/${token}`,
    );
  });
});
