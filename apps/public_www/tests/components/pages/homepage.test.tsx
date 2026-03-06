import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePageSections } from '@/components/pages/homepage';
import enContent from '@/content/en.json';

const PHONE_ENV_KEY = 'NEXT_PUBLIC_BUSINESS_PHONE_NUMBER';
const originalPhoneEnv = process.env[PHONE_ENV_KEY];

afterEach(() => {
  if (typeof originalPhoneEnv === 'string') {
    process.env[PHONE_ENV_KEY] = originalPhoneEnv;
  } else {
    delete process.env[PHONE_ENV_KEY];
  }
});

const heroBannerPropsSpy = vi.fn<
  [{ content: { headline: string }; ctaHref?: string }],
  void
>();
const pageLayoutPropsSpy = vi.fn<
  [{ navbarContent: { bookNow: { href: string; label: string } } }],
  void
>();

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({
    children,
    navbarContent,
  }: {
    children: ReactNode;
    navbarContent: { bookNow: { href: string; label: string } };
  }) => {
    pageLayoutPropsSpy({ navbarContent });
    return <div data-testid='page-layout'>{children}</div>;
  },
}));
vi.mock('@/components/sections/hero-banner', () => ({
  HeroBanner: ({
    content,
    ctaHref,
  }: {
    content: { headline: string };
    ctaHref?: string;
  }) => {
    heroBannerPropsSpy({ content, ctaHref });
    return <section data-testid='hero-banner'>{content.headline}</section>;
  },
}));
vi.mock('@/components/sections/ida-intro', () => ({
  IdaIntro: ({ content }: { content: { heading: string; body: string } }) => (
    <section data-testid='ida-intro'>
      <h2>{content.heading}</h2>
      <p>{content.body}</p>
    </section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie-overview', () => ({
  MyBestAuntieOverview: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-overview'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/course-highlights', () => ({
  CourseHighlights: ({ content }: { content: { title: string } }) => (
    <section data-testid='course-highlights'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-resources-for-gentle-parenting', () => ({
  FreeResourcesForGentleParenting: ({
    content,
  }: {
    content: { title: string };
  }) => (
    <section data-testid='free-resources-for-gentle-parenting'>
      {content.title}
    </section>
  ),
}));
vi.mock('@/components/sections/deferred-testimonials', () => ({
  DeferredTestimonials: ({ content }: { content: { title: string } }) => (
    <section data-testid='deferred-testimonials'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: ({ content }: { content: { heading: string } }) => (
    <section data-testid='sprouts-squad-community'>{content.heading}</section>
  ),
}));

describe('HomePageSections', () => {
  it('composes homepage sections with the expected content slices', () => {
    process.env[PHONE_ENV_KEY] = '+852 9876 5432';
    heroBannerPropsSpy.mockClear();
    pageLayoutPropsSpy.mockClear();
    render(<HomePageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('hero-banner')).toBeInTheDocument();
    expect(screen.getByTestId('ida-intro')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-overview')).toBeInTheDocument();
    expect(screen.getByTestId('course-highlights')).toBeInTheDocument();
    expect(screen.getByTestId('free-resources-for-gentle-parenting')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();
    expect(screen.getByText(enContent.hero.headline)).toBeInTheDocument();
    expect(screen.getByText(enContent.idaIntro.heading)).toBeInTheDocument();
    expect(screen.getByText(enContent.idaIntro.body)).toBeInTheDocument();
    expect(
      screen.getByTestId('my-best-auntie-overview'),
    ).toHaveTextContent('Best Auntie Training Course Designed by Ida');
    expect(heroBannerPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaHref: expect.stringContaining('https://wa.me/85298765432'),
      }),
    );
    expect(heroBannerPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaHref: expect.stringContaining('text='),
      }),
    );
    expect(heroBannerPropsSpy).toHaveBeenCalledTimes(1);
    expect(pageLayoutPropsSpy).toHaveBeenCalledTimes(1);

    const heroProps = heroBannerPropsSpy.mock.calls[0][0];
    const pageLayoutProps = pageLayoutPropsSpy.mock.calls[0][0];
    expect(pageLayoutProps.navbarContent.bookNow.href).toBe(heroProps.ctaHref);
    expect(pageLayoutProps.navbarContent.bookNow.label).toBe(
      enContent.navbar.bookNow.label,
    );
  });
});
