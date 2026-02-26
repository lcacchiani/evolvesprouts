import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HomePageSections } from '@/components/pages/homepage';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/hero-banner', () => ({
  HeroBanner: ({ content }: { content: { headline: string } }) => (
    <section data-testid='hero-banner'>{content.headline}</section>
  ),
}));
vi.mock('@/components/sections/ida-intro', () => ({
  IdaIntro: ({ content }: { content: { text: string } }) => (
    <section data-testid='ida-intro'>{content.text}</section>
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
    expect(screen.getByText(enContent.idaIntro.text)).toBeInTheDocument();
    expect(
      screen.getByTestId('my-best-auntie-overview'),
    ).toHaveTextContent('Best Auntie Training Course Designed by Ida');
  });
});
