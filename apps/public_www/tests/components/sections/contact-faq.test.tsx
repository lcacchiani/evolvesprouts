import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContactFaq } from '@/components/sections/contact-faq';
import enContent from '@/content/en.json';

describe('ContactFaq', () => {
  it('renders contact faq section with two cards', () => {
    const content = enContent.contactUs.contactFaq;
    const { container } = render(<ContactFaq content={content} />);

    const section = screen.getByRole('region', {
      name: content.title,
    });
    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-contact-faq-section');
    expect(section.className).not.toContain('es-testimonials-section');

    expect(
      screen.getByRole('heading', {
        name: content.title,
      }),
    ).toBeInTheDocument();

    expect(content.cards).toHaveLength(2);
    for (const card of content.cards) {
      const cardHeading = screen.getByRole('heading', { name: card.question });
      expect(cardHeading).toBeInTheDocument();
      expect(cardHeading.className).toContain('es-type-subtitle');
      expect(screen.getByText(card.answer)).toBeInTheDocument();
    }

    expect(container.querySelectorAll('article')).toHaveLength(2);
  });
});
