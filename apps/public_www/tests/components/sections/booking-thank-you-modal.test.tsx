import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BookingThankYouModal } from '@/components/sections/booking-modal/thank-you-modal';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import enContent from '@/content/en.json';
import zhCnContent from '@/content/zh-CN.json';
import { trackAnalyticsEvent } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
}));

vi.mock('@/lib/hooks/use-modal-lock-body', () => ({
  useModalLockBody: () => {},
}));

vi.mock('@/lib/hooks/use-modal-focus-management', () => ({
  useModalFocusManagement: () => {},
}));

vi.mock('@/lib/meta-pixel', () => ({
  trackMetaPixelEvent: vi.fn(),
}));

describe('BookingThankYouModal', () => {
  const thankYouEn = enContent.bookingModal.thankYouModal;
  const thankYouZhCn = zhCnContent.bookingModal.thankYouModal;

  it('shows consultation date with morning phrasing from HKT hour', () => {
    const summary: ReservationSummary = {
      attendeeName: 'Pat',
      attendeeEmail: 'pat@example.com',
      attendeePhone: '123',
      paymentMethod: 'Credit Card',
      paymentMethodCode: 'stripe',
      totalAmount: 100,
      eventTitle: 'Consultation',
      courseSlug: 'consultation-booking',
      dateStartTime: '2026-05-16T02:00:00Z',
      courseSessions: [{ dateStartTime: '2026-05-16T02:00:00Z' }],
    };

    render(
      <BookingThankYouModal
        locale='en'
        content={thankYouEn}
        summary={summary}
        analyticsSectionId='test'
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('16 May in the morning')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: thankYouEn.downloadCalendarInviteLabel }),
    ).toBeNull();
  });

  it('shows consultation date with AM marker for zh-CN', () => {
    const summary: ReservationSummary = {
      attendeeName: 'Pat',
      attendeeEmail: 'pat@example.com',
      attendeePhone: '123',
      paymentMethod: 'Credit Card',
      paymentMethodCode: 'stripe',
      totalAmount: 100,
      eventTitle: '咨询',
      courseSlug: 'consultation-booking',
      dateStartTime: '2026-05-16T02:00:00Z',
      courseSessions: [{ dateStartTime: '2026-05-16T02:00:00Z' }],
    };

    render(
      <BookingThankYouModal
        locale='zh-CN'
        content={thankYouZhCn}
        summary={summary}
        analyticsSectionId='test'
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('5月16日 AM')).toBeInTheDocument();
  });

  it('uses zh-CN ordinals for MBA group session lines', () => {
    const summary: ReservationSummary = {
      attendeeName: 'U',
      attendeeEmail: 'u@example.com',
      attendeePhone: '1',
      paymentMethod: 'FPS',
      paymentMethodCode: 'fps_qr',
      totalAmount: 1,
      eventTitle: 'MBA',
      courseSlug: 'my-best-auntie',
      courseSessions: [
        { dateStartTime: '2026-04-10T06:00:00Z' },
        { dateStartTime: '2026-05-01T06:00:00Z' },
      ],
    };

    render(
      <BookingThankYouModal
        locale='zh-CN'
        content={thankYouZhCn}
        summary={summary}
        analyticsSectionId='test'
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(/第一节/u)).toBeInTheDocument();
    expect(screen.getByText(/第二节/u)).toBeInTheDocument();
  });

  it('shows disabled calendar download when summary has no session datetimes', () => {
    const summary: ReservationSummary = {
      attendeeName: 'Pat',
      attendeeEmail: 'pat@example.com',
      attendeePhone: '123',
      paymentMethod: 'Bank Transfer',
      paymentMethodCode: 'bank_transfer',
      totalAmount: 50,
      eventTitle: 'Workshop',
      courseSlug: 'event-booking',
    };

    render(
      <BookingThankYouModal
        locale='en'
        content={thankYouEn}
        summary={summary}
        analyticsSectionId='test'
        onClose={() => {}}
      />,
    );

    const icsButton = screen.getByRole('button', {
      name: thankYouEn.downloadCalendarInviteLabel,
    });
    expect(icsButton).toBeDisabled();
    expect(screen.queryByText(thankYouEn.dateTimeLabel)).not.toBeInTheDocument();
  });

  it('tracks ICS download from ICS-only row', () => {
    const summary: ReservationSummary = {
      attendeeName: 'Pat',
      attendeeEmail: 'pat@example.com',
      attendeePhone: '123',
      paymentMethod: 'Bank Transfer',
      paymentMethodCode: 'bank_transfer',
      totalAmount: 50,
      eventTitle: 'Workshop',
      courseSlug: 'event-booking',
      courseSessions: [{ dateStartTime: '2026-06-01T10:00:00.000Z' }],
    };

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <BookingThankYouModal
        locale='en'
        content={thankYouEn}
        summary={summary}
        analyticsSectionId='events-test'
        onClose={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: thankYouEn.downloadCalendarInviteLabel,
      }),
    );

    expect(trackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_thank_you_ics_download',
      expect.objectContaining({
        sectionId: 'events-test',
        ctaLocation: 'thank_you_modal',
      }),
    );

    createObjectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('hides payment row and shows free total for free reservations', () => {
    const summary: ReservationSummary = {
      attendeeName: 'Pat',
      attendeeEmail: 'pat@example.com',
      attendeePhone: '123',
      paymentMethod: '',
      paymentMethodCode: 'free',
      totalAmount: 0,
      eventTitle: 'Workshop',
      courseSlug: 'event-booking',
    };

    render(
      <BookingThankYouModal
        locale='en'
        content={thankYouEn}
        summary={summary}
        analyticsSectionId='test'
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText(thankYouEn.paymentMethodLabel)).not.toBeInTheDocument();
    const freeTotal = screen.getByText(thankYouEn.freeTotalLabel);
    expect(freeTotal.className).toContain('es-text-success');
    expect(screen.queryByText(thankYouEn.fpsReservationPendingNote)).not.toBeInTheDocument();
  });

  it('shows service type in the left column and title in the right for the recap row', () => {
    const summary: ReservationSummary = {
      attendeeName: 'Pat',
      attendeeEmail: 'pat@example.com',
      attendeePhone: '123',
      paymentMethod: 'Credit Card',
      paymentMethodCode: 'stripe',
      totalAmount: 100,
      eventTitle: 'Family Consultation — long title',
      courseSlug: 'consultation-booking',
      serviceSlug: 'consultation',
    };

    render(
      <BookingThankYouModal
        locale='en'
        content={thankYouEn}
        summary={summary}
        analyticsSectionId='test'
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(thankYouEn.serviceLabels.consultation)).toBeInTheDocument();
    expect(screen.getByText('Family Consultation — long title')).toBeInTheDocument();
  });
});
