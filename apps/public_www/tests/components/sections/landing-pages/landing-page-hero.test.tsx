/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LandingPageHero } from '@/components/sections/landing-pages/landing-page-hero';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
import type { EventBookingModalPayload } from '@/lib/events-data';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('LandingPageHero section', () => {
  it('renders section shell identifiers and hero content', async () => {
    const eventContent = {
      title: 'Easter 2026 Montessori Play Coaching Workshop',
      startDateTime: '2026-04-06T02:00:00Z',
      endDateTime: '2026-04-06T03:00:00Z',
      locationLabel: 'Wan Chai',
      partners: ['happy-baton', 'baumhaus'],
      categoryChips: ['Workshop'],
    };
    const expectedDateChip = 'Monday 06 April 2026';
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const expectedTimeChip = `${timeFormatter.format(new Date(eventContent.startDateTime))} - ${timeFormatter.format(new Date(eventContent.endDateTime))}`;
    const bookingPayload: EventBookingModalPayload = {
      variant: 'event',
      bookingSystem: 'event-booking',
      title: eventContent.title,
      subtitle: 'A practical workshop',
      originalAmount: 350,
      locationName: 'Baumhaus',
      locationAddress: "Baumhaus, 1/F Kar Yau Building, 36-44 Queen's Rd E, Wan Chai",
      directionHref:
        'https://www.google.com/maps/dir/?api=1&destination=Baumhaus,+1/F+Kar+Yau+Building,+36-44+Queen%27s+Rd+E,+Wan+Chai',
      dateParts: [
        {
          id: 'session-1',
          startDateTime: eventContent.startDateTime,
          endDateTime: eventContent.endDateTime,
          description: 'A practical workshop',
        },
      ],
      selectedDateLabel: '06 Apr 2026',
      selectedDateStartTime: eventContent.startDateTime,
    };

    render(
      <LandingPageHero
        slug='easter-2026-montessori-play-coaching-workshop'
        content={easterWorkshopContent.en.hero}
        ctaContent={easterWorkshopContent.en.cta}
        commonContent={enContent.landingPages.common}
        locale='en'
        title={eventContent.title}
        eventContent={eventContent}
        bookingPayload={bookingPayload}
        isFullyBooked={false}
        bookingModalContent={enContent.bookingModal}
      />,
    );

    const section = document.getElementById('landing-page-hero');
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-figma-node')).toBe('landing-page-hero');
    expect(section).toHaveClass('es-bg-surface-white');
    expect(screen.getByRole('heading', { name: eventContent.title }))
      .toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(easterWorkshopContent.en.hero.description)).toBeInTheDocument();
    expect(await screen.findByText(expectedDateChip)).toBeInTheDocument();
    expect(await screen.findByText(expectedTimeChip)).toBeInTheDocument();
    expect(await screen.findByText('Wan Chai')).toBeInTheDocument();
    expect(await screen.findByText('Workshop')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: easterWorkshopContent.en.cta.buttonLabel }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-hero-partners')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-partner-logo-happy-baton')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-partner-logo-baumhaus')).toBeInTheDocument();
    expect(screen.queryByText('Helpers Welcome')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('img', { name: easterWorkshopContent.en.hero.imageAlt }),
    ).toHaveLength(2);
  });
});
