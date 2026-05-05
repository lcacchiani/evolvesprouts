import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IntroCallSlotPicker } from '@/components/sections/landing-pages/intro-call-slot-picker';
import enContent from '@/content/en.json';
import bookAFreeCall from '@/content/landing-pages/book-a-free-call.json';

vi.mock('@/lib/intro-call-slots-api', () => ({
  CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS: 30000,
  fetchIntroCallSlots: vi.fn(),
}));

const { fetchIntroCallSlots } = await import('@/lib/intro-call-slots-api');

const MD_UP_MEDIA_QUERY = '(min-width: 768px)';
const originalMatchMedia = window.matchMedia;

function mockViewportMdUp(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === MD_UP_MEDIA_QUERY ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  vi.mocked(fetchIntroCallSlots).mockReset();
  vi.unstubAllGlobals();
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  } else {
    Reflect.deleteProperty(window, 'matchMedia');
  }
});

describe('IntroCallSlotPicker', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it('shows loading gear with test id while slots load', async () => {
    vi.mocked(fetchIntroCallSlots).mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves in this test */
        }),
    );

    render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('intro-call-slots-loading')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '09:00' })).toBeNull();
  });

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
      expect(screen.queryByTestId('intro-call-slots-loading')).toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument();
    });
  });

  it('toggles aria-pressed on day and time selection without icon masks in buttons', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-06T01:00:00.000Z', endIso: '2026-05-06T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    const { container } = render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument();
    });

    const dayPressedTrue = screen.getAllByRole('button', { pressed: true });
    expect(dayPressedTrue.length).toBe(1);
    const firstDay = dayPressedTrue[0] as HTMLButtonElement;
    expect(firstDay).toHaveTextContent('Tue');

    const wedButton = screen.getByRole('button', { name: /Wed/i });
    expect(wedButton).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(wedButton);

    await waitFor(() => {
      expect(wedButton).toHaveAttribute('aria-pressed', 'true');
    });
    expect(firstDay).toHaveAttribute('aria-pressed', 'false');

    const timeBtn = screen.getByRole('button', { name: '09:00' });
    expect(timeBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(timeBtn);
    await waitFor(() => {
      expect(timeBtn).toHaveAttribute('aria-pressed', 'true');
    });

    const selectionButtons = container.querySelectorAll('.es-btn--selection');
    selectionButtons.forEach((el) => {
      expect(el.querySelector('svg')).toBeNull();
      expect(el.querySelector('.es-ui-icon-mask')).toBeNull();
    });
  });

  it('does not render date carousel arrows when fewer than three days have slots', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-05T02:30:00.000Z', endIso: '2026-05-05T02:45:00.000Z' },
      ],
      fetchFailed: false,
    });

    mockViewportMdUp(true);

    render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: bookAFreeCall.en.introCall.scrollDatesLeftAriaLabel }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: bookAFreeCall.en.introCall.scrollDatesRightAriaLabel }),
    ).toBeNull();
  });

  it('renders date carousel arrows with localized labels when enough days and md viewport', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-04T01:00:00.000Z', endIso: '2026-05-04T01:15:00.000Z' },
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-06T01:00:00.000Z', endIso: '2026-05-06T01:15:00.000Z' },
        { startIso: '2026-05-07T01:00:00.000Z', endIso: '2026-05-07T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    mockViewportMdUp(true);

    render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    const track = await screen.findByTestId('intro-call-day-carousel');
    let scrollLeft = 100;
    Object.defineProperty(track, 'clientWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, get: () => 800 });
    Object.defineProperty(track, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeft,
      set: (v: number) => {
        scrollLeft = v;
      },
    });

    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: bookAFreeCall.en.introCall.scrollDatesLeftAriaLabel }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: bookAFreeCall.en.introCall.scrollDatesRightAriaLabel }),
    ).toBeInTheDocument();
  });

  it('groups morning and afternoon slots with section labels', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-05T06:30:00.000Z', endIso: '2026-05-05T06:45:00.000Z' },
      ],
      fetchFailed: false,
    });

    render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(bookAFreeCall.en.introCall.morningSectionLabel)).toBeInTheDocument();
    });
    expect(screen.getByText(bookAFreeCall.en.introCall.afternoonSectionLabel)).toBeInTheDocument();

    const morningGroup = screen.getByRole('group', {
      name: `Morning: ${bookAFreeCall.en.introCall.bookingSectionTitle}`,
    });
    expect(within(morningGroup).getByRole('button', { name: '09:00' })).toBeInTheDocument();

    const afternoonGroup = screen.getByRole('group', {
      name: `Afternoon: ${bookAFreeCall.en.introCall.bookingSectionTitle}`,
    });
    expect(within(afternoonGroup).getByRole('button', { name: '14:30' })).toBeInTheDocument();
  });

  it('renders load error message and WhatsApp link when fetch fails', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({ slots: [], fetchFailed: true });

    const onSelect = vi.fn();
    const loadError =
      'We could not load available times. Please refresh, or message us on WhatsApp.';

    render(
      <IntroCallSlotPicker
        commonAccessibility={enContent.common.accessibility}
        pickerContent={{
          ...bookAFreeCall.en.introCall,
          loadErrorMessage: loadError,
        }}
        whatsappHref='https://wa.me/85290000000'
        onSelect={onSelect}
      />,
    );

    expect(await screen.findByText(loadError, { exact: false })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: bookAFreeCall.en.introCall.whatsappHelpCtaLabel });
    expect(link).toHaveAttribute('href', 'https://wa.me/85290000000');
  });
});
