import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HomePageSections } from '@/components/pages/homepage';
import enContent from '@/content/en.json';

const heroBannerMock = vi.fn(() => <section data-testid='hero-banner' />);
const overviewMock = vi.fn(() => <section data-testid='my-best-auntie-overview' />);
const courseHighlightsMock = vi.fn(() => <section data-testid='course-highlights' />);
const freeResourcesMock = vi.fn(
  () => <section data-testid='free-resources-for-gentle-parenting' />,
);
const deferredTestimonialsMock = vi.fn(() => <section data-testid='deferred-testimonials' />);
const sproutsCommunityMock = vi.fn(() => <section data-testid='sprouts-squad-community' />);

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/hero-banner', () => ({
  HeroBanner: heroBannerMock,
}));
vi.mock('@/components/sections/my-best-auntie-overview', () => ({
  MyBestAuntieOverview: overviewMock,
}));
vi.mock('@/components/sections/course-highlights', () => ({
  CourseHighlights: courseHighlightsMock,
}));
vi.mock('@/components/sections/free-resources-for-gentle-parenting', () => ({
  FreeResourcesForGentleParenting: freeResourcesMock,
}));
vi.mock('@/components/sections/deferred-testimonials', () => ({
  DeferredTestimonials: deferredTestimonialsMock,
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: sproutsCommunityMock,
}));

describe('HomePageSections', () => {
  it('composes homepage sections with the expected content slices', () => {
    render(<HomePageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('hero-banner')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-overview')).toBeInTheDocument();
    expect(screen.getByTestId('course-highlights')).toBeInTheDocument();
    expect(screen.getByTestId('free-resources-for-gentle-parenting')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();

    expect(heroBannerMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.hero,
    });
    expect(overviewMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.myBestAuntieOverview,
    });
    expect(courseHighlightsMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.courseHighlights,
    });
  });
});
