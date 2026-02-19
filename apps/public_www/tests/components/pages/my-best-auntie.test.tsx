import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntie } from '@/components/pages/my-best-auntie';
import enContent from '@/content/en.json';

const bookingMock = vi.fn(() => <section data-testid='my-best-auntie-booking' />);
const descriptionMock = vi.fn(() => <section data-testid='my-best-auntie-description' />);
const faqMock = vi.fn(() => <section data-testid='faq' />);
const deferredTestimonialsMock = vi.fn(() => <section data-testid='deferred-testimonials' />);
const sproutsCommunityMock = vi.fn(() => <section data-testid='sprouts-squad-community' />);

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/my-best-auntie-booking', () => ({
  MyBestAuntieBooking: bookingMock,
}));
vi.mock('@/components/sections/my-best-auntie-description', () => ({
  MyBestAuntieDescription: descriptionMock,
}));
vi.mock('@/components/sections/faq', () => ({
  Faq: faqMock,
}));
vi.mock('@/components/sections/deferred-testimonials', () => ({
  DeferredTestimonials: deferredTestimonialsMock,
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: sproutsCommunityMock,
}));

describe('MyBestAuntie page', () => {
  it('assembles the booking flow page and forwards locale', () => {
    render(<MyBestAuntie locale='zh-HK' content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-booking')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-description')).toBeInTheDocument();
    expect(screen.getByTestId('faq')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();

    expect(bookingMock.mock.calls[0]?.[0]).toMatchObject({
      locale: 'zh-HK',
      content: enContent.myBestAuntieBooking,
    });
  });
});
