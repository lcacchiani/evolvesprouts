import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Connect } from '@/components/sections/connect';
import { getContent } from '@/content';

describe('Connect section', () => {
  it('uses migrated section/title classes and keeps CTA links', () => {
    const content = getContent('en');
    const { container } = render(<Connect content={content.contactUs.connect} />);

    const section = screen.getByRole('region', {
      name: content.contactUs.connect.title,
    });
    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-connect-section');

    const firstCardTitle = screen.getByRole('heading', {
      level: 3,
      name: content.contactUs.connect.cards[0].title,
    });
    expect(firstCardTitle.className).toContain('es-connect-card-title');

    const blueGlyph = container.querySelector('span.es-connect-glyph--blue');
    const greenGlyph = container.querySelector('span.es-connect-glyph--green');
    const orangeGlyph = container.querySelector('span.es-connect-glyph--orange');
    expect(blueGlyph).not.toBeNull();
    expect(greenGlyph).not.toBeNull();
    expect(orangeGlyph).not.toBeNull();
    expect(blueGlyph?.querySelector('.es-ui-icon-mask--connect-glyph-arrow')).not.toBeNull();

    const emailLink = screen.getByRole('link', {
      name: content.contactUs.connect.cards[0].ctaLabel,
    });
    expect(emailLink).toHaveAttribute('href', content.contactUs.connect.cards[0].ctaHref);
  });
});
