import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EventsPageSections } from '@/components/pages/events';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/events', () => ({
  Events: ({
    content,
    locale,
  }: {
    content: { title: string };
    locale: string;
  }) => (
    <section data-testid='events-section'>{`${content.title} (${locale})`}</section>
  ),
}));
vi.mock('@/components/sections/past-events', () => ({
  PastEvents: ({ content }: { content: { past: { title: string } } }) => (
    <section data-testid='past-events-section'>{content.past.title}</section>
  ),
}));
vi.mock('@/components/sections/event-notification', () => ({
  EventNotification: ({ content }: { content: { title: string } }) => (
    <section data-testid='event-notification-section'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-intro-session', () => ({
  FreeIntroSession: ({ content }: { content: { ctaLabel: string } }) => (
    <section data-testid='free-intro-session'>{content.ctaLabel}</section>
  ),
}));

describe('EventsPageSections', () => {
  it('composes events page sections with locale-aware props', () => {
    render(<EventsPageSections content={enContent} />);

    const pageLayout = screen.getByTestId('page-layout');
    expect(pageLayout).toBeInTheDocument();
    expect(screen.getByTestId('events-section')).toHaveTextContent(
      `${enContent.events.title} (${enContent.meta.locale})`,
    );
    expect(screen.getByTestId('past-events-section')).toHaveTextContent(
      enContent.events.past.title,
    );
    expect(screen.getByTestId('event-notification-section')).toHaveTextContent(
      enContent.eventNotification.title,
    );
    expect(screen.getByTestId('free-intro-session')).toBeInTheDocument();

    const renderedSectionOrder = Array.from(pageLayout.querySelectorAll('section')).map(
      (section) => section.getAttribute('data-testid'),
    );
    expect(renderedSectionOrder).toEqual([
      'events-section',
      'free-intro-session',
      'past-events-section',
      'event-notification-section',
    ]);
  });
});
