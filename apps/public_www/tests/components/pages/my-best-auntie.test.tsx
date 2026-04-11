import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntiePage } from '@/components/pages/my-best-auntie';
import { getContent } from '@/content';
import { buildWhatsappPrefilledHref } from '@/lib/site-config';

const BOOKING_PROPS_SPY = vi.fn();

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-hero', () => ({
  MyBestAuntieHero: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-hero'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-booking', () => ({
  MyBestAuntieBooking: ({
    content,
    locale,
    privateProgrammeWhatsappHref,
  }: {
    content: { title: string };
    locale: string;
    privateProgrammeWhatsappHref?: string;
  }) => (
    (() => {
      BOOKING_PROPS_SPY({
        content,
        locale,
        privateProgrammeWhatsappHref,
      });
      return (
        <section data-testid='my-best-auntie-booking'>
          {content.title} ({locale})
        </section>
      );
    })()
  ),
}));
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-description', () => ({
  MyBestAuntieDescription: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-description'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-outline', () => ({
  MyBestAuntieOutline: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-outline'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/faq', () => ({
  Faq: ({ content }: { content: { title: string } }) => (
    <section data-testid='faq'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/testimonials', () => ({
  Testimonials: ({ content }: { content: { title: string } }) => (
    <section data-testid='testimonials'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-intro-session', () => ({
  FreeIntroSession: ({ content }: { content: { title: string } }) => (
    <section data-testid='free-intro-session'>{content.title}</section>
  ),
}));

describe('MyBestAuntiePage', () => {
  it('assembles the booking flow page and forwards locale', () => {
    BOOKING_PROPS_SPY.mockClear();
    const content = getContent('zh-HK');
    render(<MyBestAuntiePage locale='zh-HK' content={content} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-hero')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-description')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-outline')).toBeInTheDocument();
    expect(screen.getByTestId('testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-booking')).toBeInTheDocument();
    expect(screen.getByTestId('faq')).toBeInTheDocument();
    expect(screen.getByTestId('free-intro-session')).toBeInTheDocument();
    expect(screen.getByTestId('page-layout').firstElementChild).toHaveAttribute(
      'data-testid',
      'my-best-auntie-hero',
    );
    expect(
      screen.getByTestId('my-best-auntie-description').compareDocumentPosition(
        screen.getByTestId('my-best-auntie-outline'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('testimonials').compareDocumentPosition(
        screen.getByTestId('my-best-auntie-booking'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('my-best-auntie-booking').compareDocumentPosition(
        screen.getByTestId('faq'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByText(`${content.myBestAuntie.booking.title} (zh-HK)`),
    ).toBeInTheDocument();
    expect(BOOKING_PROPS_SPY).toHaveBeenCalledTimes(1);
    const bookingProps = BOOKING_PROPS_SPY.mock.calls[0][0] as {
      privateProgrammeWhatsappHref?: string;
    };
    expect(bookingProps.privateProgrammeWhatsappHref).toBe(
      buildWhatsappPrefilledHref(
        content.freeIntroSession.ctaHref,
        content.myBestAuntie.booking.privateProgrammePrefillMessage,
        content.freeIntroSession.phoneNumber,
      ) || content.freeIntroSession.ctaHref,
    );
  });
});
