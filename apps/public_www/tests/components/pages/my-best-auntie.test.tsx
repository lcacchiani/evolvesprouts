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
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-hero', () => ({
  MyBestAuntieHero: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-hero'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-booking', () => ({
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

describe('MyBestAuntie page', () => {
  it('assembles the booking flow page and forwards locale', () => {
    render(<MyBestAuntie locale='zh-HK' content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-hero')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-description')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-outline')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-booking')).toBeInTheDocument();
    expect(screen.getByTestId('faq')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();
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
      screen.getByTestId('deferred-testimonials').compareDocumentPosition(
        screen.getByTestId('my-best-auntie-booking'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('my-best-auntie-booking').compareDocumentPosition(
        screen.getByTestId('faq'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByText(`${enContent.myBestAuntieBooking.title} (zh-HK)`),
    ).toBeInTheDocument();
  });
});
