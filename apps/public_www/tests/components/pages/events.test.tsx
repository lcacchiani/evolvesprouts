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
  Events: ({ content, locale }: { content: { title: string }; locale: string }) => (
    <section data-testid='events-section'>{`${content.title} (${locale})`}</section>
  ),
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: ({ content }: { content: { heading: string } }) => (
    <section data-testid='sprouts-squad-community'>{content.heading}</section>
  ),
}));

describe('EventsPageSections', () => {
  it('composes events page sections with locale-aware props', () => {
    render(<EventsPageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('events-section')).toHaveTextContent(
      `${enContent.events.title} (${enContent.meta.locale})`,
    );
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();
  });
});
