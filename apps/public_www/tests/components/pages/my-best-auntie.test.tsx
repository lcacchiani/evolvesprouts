import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntie } from '@/components/pages/my-best-auntie';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/my-best-auntie-booking', () => ({
  MyBestAuntieBooking: ({
    content,
    locale,
  }: {
    content: { title: string };
    locale: string;
  }) => (
    <section data-testid='my-best-auntie-booking'>
      {content.title} ({locale})
    </section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie-description', () => ({
  MyBestAuntieDescription: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-description'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/faq', () => ({
  Faq: ({ content }: { content: { title: string } }) => (
    <section data-testid='faq'>{content.title}</section>
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

describe('MyBestAuntie page', () => {
  it('assembles the booking flow page and forwards locale', () => {
    render(<MyBestAuntie locale='zh-HK' content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-booking')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-description')).toBeInTheDocument();
    expect(screen.getByTestId('faq')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();
    expect(
      screen.getByText(`${enContent.myBestAuntieBooking.title} (zh-HK)`),
    ).toBeInTheDocument();
  });
});
