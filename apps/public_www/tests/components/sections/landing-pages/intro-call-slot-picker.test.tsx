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

afterEach(() => {
  vi.mocked(fetchIntroCallSlots).mockReset();
  vi.unstubAllGlobals();
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
        locale='en'
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
        locale='en'
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

  it('toggles aria-pressed on day and time selection without icon masks in selection buttons', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-06T01:00:00.000Z', endIso: '2026-05-06T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    const { container } = render(
      <IntroCallSlotPicker
        locale='en'
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
    expect(firstDay).toHaveTextContent(/Tue\s+05\s+May/i);

    const wedButton = screen.getByRole('button', { name: /Wed\s+06\s+May/i });
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

  it('moves roving tabindex with ArrowRight on the day strip', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-06T01:00:00.000Z', endIso: '2026-05-06T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    render(
      <IntroCallSlotPicker
        locale='en'
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    const tueButton = await screen.findByRole('button', { name: /Tue\s+05\s+May/i });
    expect(tueButton).toHaveAttribute('tabIndex', '0');
    expect(tueButton).toHaveAttribute('aria-pressed', 'true');

    const wedButton = screen.getByRole('button', { name: /Wed\s+06\s+May/i });
    expect(wedButton).toHaveAttribute('tabIndex', '-1');

    fireEvent.keyDown(tueButton, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(wedButton).toHaveAttribute('aria-pressed', 'true');
    });
    expect(wedButton).toHaveAttribute('tabIndex', '0');
    expect(tueButton).toHaveAttribute('tabIndex', '-1');
    expect(wedButton).toHaveFocus();
  });

  it('does not render date carousel arrow controls', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-04T01:00:00.000Z', endIso: '2026-05-04T01:15:00.000Z' },
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-06T01:00:00.000Z', endIso: '2026-05-06T01:15:00.000Z' },
        { startIso: '2026-05-07T01:00:00.000Z', endIso: '2026-05-07T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    render(
      <IntroCallSlotPicker
        locale='en'
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '09:00' })).toBeInTheDocument();
    });

    const track = screen.getByTestId('intro-call-day-carousel');
    Object.defineProperty(track, 'clientWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(track, 'scrollWidth', { configurable: true, get: () => 800 });
    fireEvent(window, new Event('resize'));

    expect(screen.queryByRole('button', { name: /scroll dates/i })).toBeNull();
  });

  it('shows at most five future days in the date strip', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({
      slots: [
        { startIso: '2026-05-04T01:00:00.000Z', endIso: '2026-05-04T01:15:00.000Z' },
        { startIso: '2026-05-05T01:00:00.000Z', endIso: '2026-05-05T01:15:00.000Z' },
        { startIso: '2026-05-06T01:00:00.000Z', endIso: '2026-05-06T01:15:00.000Z' },
        { startIso: '2026-05-07T01:00:00.000Z', endIso: '2026-05-07T01:15:00.000Z' },
        { startIso: '2026-05-08T01:00:00.000Z', endIso: '2026-05-08T01:15:00.000Z' },
        { startIso: '2026-05-09T01:00:00.000Z', endIso: '2026-05-09T01:15:00.000Z' },
      ],
      fetchFailed: false,
    });

    render(
      <IntroCallSlotPicker
        locale='en'
        commonAccessibility={enContent.common.accessibility}
        pickerContent={bookAFreeCall.en.introCall}
        onSelect={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mon\s+04\s+May/i })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Sat\s+09\s+May/i })).toBeNull();
    const dayStrip = screen.getByTestId('intro-call-day-carousel');
    const dayButtons = within(dayStrip).getAllByRole('button');
    expect(dayButtons).toHaveLength(5);
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
        locale='en'
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
      name: `Morning · ${bookAFreeCall.en.introCall.bookingSectionTitle}`,
    });
    expect(within(morningGroup).getByRole('button', { name: '09:00' })).toBeInTheDocument();

    const afternoonGroup = screen.getByRole('group', {
      name: `Afternoon · ${bookAFreeCall.en.introCall.bookingSectionTitle}`,
    });
    expect(within(afternoonGroup).getByRole('button', { name: '14:30' })).toBeInTheDocument();
  });

  it('renders load error message and WhatsApp link when fetch fails', async () => {
    vi.mocked(fetchIntroCallSlots).mockResolvedValue({ slots: [], fetchFailed: true });

    const onSelect = vi.fn();
    const loadError =
      'We could not load available times. Please refresh, or';

    render(
      <IntroCallSlotPicker
        locale='en'
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
    const link = screen.getByRole('link', { name: bookAFreeCall.en.introCall.whatsappAfterBookLabel });
    expect(link).toHaveAttribute('href', 'https://wa.me/85290000000');
  });
});
