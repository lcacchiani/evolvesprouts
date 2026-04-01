import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FreeGuidesAndResourcesPage } from '@/components/pages/free-guides-and-resources';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/free-guides-and-resources-hero', () => ({
  FreeGuidesAndResourcesHero: ({ content }: { content: { title: string } }) => (
    <section data-testid='free-guides-hero'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-resources-for-gentle-parenting', () => ({
  FreeResourcesForGentleParenting: ({
    content,
  }: {
    content: { title: string };
  }) => <section data-testid='free-resources-section'>{content.title}</section>,
}));
vi.mock('@/components/sections/free-guides-and-resources-library', () => ({
  FreeGuidesAndResourcesLibrary: ({
    content,
  }: {
    content: { title: string };
  }) => <section data-testid='free-guides-library'>{content.title}</section>,
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: ({ content }: { content: { title: string } }) => (
    <section data-testid='sprouts-squad'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-guides-and-resources-faq', () => ({
  FreeGuidesAndResourcesFaq: ({ content }: { content: { title: string } }) => (
    <section data-testid='free-guides-faq'>{content.title}</section>
  ),
}));

describe('FreeGuidesAndResourcesPage', () => {
  it('composes all page sections with scoped content', () => {
    render(<FreeGuidesAndResourcesPage content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('free-guides-hero')).toHaveTextContent(
      enContent.freeGuidesAndResources.hero.title,
    );
    expect(screen.getByTestId('free-resources-section')).toHaveTextContent(
      enContent.resources.title,
    );
    expect(screen.getByTestId('free-guides-library')).toHaveTextContent(
      enContent.freeGuidesAndResources.library.title,
    );
    expect(screen.getByTestId('free-guides-faq')).toHaveTextContent(
      enContent.freeGuidesAndResources.faq.title,
    );
    expect(screen.getByTestId('sprouts-squad')).toHaveTextContent(
      enContent.sproutsSquadCommunity.title,
    );

    const layout = screen.getByTestId('page-layout');
    const sectionOrder = Array.from(layout.children).map((node) =>
      node.getAttribute('data-testid'),
    );
    expect(sectionOrder.indexOf('free-guides-faq')).toBeLessThan(
      sectionOrder.indexOf('sprouts-squad'),
    );
  });
});
