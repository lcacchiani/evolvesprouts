import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LandingPage } from '@/components/pages/landing-pages/landing-page';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

vi.mock('@/lib/events-data', () => ({
  getLandingPageHeroEventContent: () => ({
    title: 'Mock Event Title',
    startDateTime: '2026-04-06T02:00:00Z',
    endDateTime: '2026-04-06T03:00:00Z',
    locationLabel: 'Wan Chai',
    categoryChips: ['Workshop'],
  }),
}));

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/landing-pages/landing-page-hero', () => ({
  LandingPageHero: ({
    title,
    eventContent,
  }: {
    title: string;
    eventContent: { locationLabel?: string; categoryChips: string[] } | null;
  }) => (
    <section data-testid='landing-page-hero'>
      {title} ({eventContent?.locationLabel ?? 'no-location'}) [{eventContent?.categoryChips.length ?? 0}]
    </section>
  ),
}));
vi.mock('@/components/sections/landing-pages/landing-page-details', () => ({
  LandingPageDetails: ({ content }: { content: { title: string } }) => (
    <section data-testid='landing-page-details'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/deferred-testimonials', () => ({
  DeferredTestimonials: ({ content }: { content: { title: string } }) => (
    <section data-testid='deferred-testimonials'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/landing-pages/landing-page-faq', () => ({
  LandingPageFaq: ({ content }: { content: { title: string } }) => (
    <section data-testid='landing-page-faq'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/landing-pages/landing-page-cta', () => ({
  LandingPageCta: ({
    content,
    commonContent,
    locale,
    slug,
  }: {
    content: { title: string };
    commonContent: { defaultCtaLabel: string };
    locale: string;
    slug: string;
  }) => (
    <section data-testid='landing-page-cta'>
      {content.title} ({locale}) [{slug}] <span>{commonContent.defaultCtaLabel}</span>
    </section>
  ),
}));

describe('LandingPage composition', () => {
  it('assembles all landing page sections in order', () => {
    render(
      <LandingPage
        locale='zh-HK'
        slug='easter-2026-montessori-play-coaching-workshop'
        siteContent={enContent}
        pageContent={easterWorkshopContent.en}
      />,
    );

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-hero')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-details')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-cta')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-faq')).toBeInTheDocument();

    expect(screen.getByTestId('page-layout').firstElementChild).toHaveAttribute(
      'data-testid',
      'landing-page-hero',
    );
    expect(
      screen.getByTestId('landing-page-hero').compareDocumentPosition(
        screen.getByTestId('landing-page-details'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('landing-page-details').compareDocumentPosition(
        screen.getByTestId('deferred-testimonials'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('deferred-testimonials').compareDocumentPosition(
        screen.getByTestId('landing-page-cta'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('landing-page-cta').compareDocumentPosition(
        screen.getByTestId('landing-page-faq'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByTestId('landing-page-hero')).toHaveTextContent(
      'Mock Event Title (Wan Chai) [1]',
    );
    expect(screen.getByTestId('landing-page-cta')).toHaveTextContent(
      `${easterWorkshopContent.en.cta.title} (zh-HK) [easter-2026-montessori-play-coaching-workshop]`,
    );
  });
});
