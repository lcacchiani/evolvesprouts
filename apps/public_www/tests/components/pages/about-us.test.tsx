import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AboutUs } from '@/components/pages/about-us';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/ida', () => ({
  Ida: ({ content }: { content: { title: string } }) => (
    <section data-testid='ida'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/my-history', () => ({
  MyHistory: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-history'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/my-journey', () => ({
  MyJourney: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-journey'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/why-us', () => ({
  WhyUs: ({ content }: { content: { title: string } }) => (
    <section data-testid='why-us'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/deferred-testimonials', () => ({
  DeferredTestimonials: ({ content }: { content: { title: string } }) => (
    <section data-testid='deferred-testimonials'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: ({ content }: { content: { title: string } }) => (
    <section data-testid='sprouts-squad-community'>{content.title}</section>
  ),
}));

describe('AboutUs page', () => {
  it('assembles all about page sections', () => {
    render(<AboutUs locale='en' content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('ida')).toBeInTheDocument();
    expect(screen.getByTestId('my-history')).toBeInTheDocument();
    expect(screen.getByTestId('my-journey')).toBeInTheDocument();
    expect(screen.getByTestId('why-us')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();
    expect(screen.getByText(enContent.aboutUs.hero.title)).toBeInTheDocument();
    expect(screen.getByText(enContent.testimonials.title)).toBeInTheDocument();
  });
});
