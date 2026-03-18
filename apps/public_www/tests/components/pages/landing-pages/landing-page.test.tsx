import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { LandingPage } from '@/components/pages/landing-pages/landing-page';
import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/landing-pages/landing-page-hero', () => ({
  LandingPageHero: ({ content }: { content: { title: string } }) => (
    <section data-testid='landing-page-hero'>{content.title}</section>
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
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-faq')).toBeInTheDocument();
    expect(screen.getByTestId('landing-page-cta')).toBeInTheDocument();

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
        screen.getByTestId('landing-page-faq'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByTestId('landing-page-cta')).toHaveTextContent(
      `${easterWorkshopContent.en.cta.title} (zh-HK) [easter-2026-montessori-play-coaching-workshop]`,
    );
  });
});
