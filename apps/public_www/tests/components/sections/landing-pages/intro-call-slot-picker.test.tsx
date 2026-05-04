import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IntroCallSlotPicker } from '@/components/sections/landing-pages/intro-call-slot-picker';
import enContent from '@/content/en.json';
import bookAFreeCall from '@/content/landing-pages/book-a-free-call.json';

vi.mock('@/lib/intro-call-slots-api', () => ({
  CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS: 30000,
  fetchIntroCallSlots: vi.fn(),
}));

const { fetchIntroCallSlots } = await import('@/lib/intro-call-slots-api');

afterEach(() => {
  vi.mocked(fetchIntroCallSlots).mockReset();
});

describe('IntroCallSlotPicker', () => {
  it('renders time buttons after slots load', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    const onSelect = vi.fn();

    render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={onSelect}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument();
    });
  });
});
