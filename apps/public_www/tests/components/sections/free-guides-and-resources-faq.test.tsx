import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FreeGuidesAndResourcesFaq } from '@/components/sections/free-guides-and-resources-faq';
import enContent from '@/content/en.json';

describe('FreeGuidesAndResourcesFaq', () => {
  it('renders Q&A cards and section shell identifiers', () => {
    const content = enContent.freeGuidesAndResources.faq;
    const { container } = render(<FreeGuidesAndResourcesFaq content={content} />);

    const section = container.querySelector(
      'section[data-figma-node="free-guides-and-resources-faq"]',
    );
    expect(section).not.toBeNull();
    expect(section?.id).toBe('free-guides-and-resources-faq');

    expect(
      screen.getByRole('region', { name: content.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: content.title }),
    ).toBeInTheDocument();

    for (const card of content.cards) {
      expect(
        screen.getByRole('heading', { name: card.question }),
      ).toBeInTheDocument();
      expect(screen.getByText(card.answer)).toBeInTheDocument();
    }
  });
});
