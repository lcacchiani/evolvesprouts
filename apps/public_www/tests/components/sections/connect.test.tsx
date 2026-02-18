import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Connect } from '@/components/sections/connect';
import enContent from '@/content/en.json';

describe('Connect section', () => {
  it('uses migrated section/title classes and keeps CTA links', () => {
    const { container } = render(<Connect content={enContent.contactUs.connect} />);

    const section = screen.getByRole('region', {
      name: enContent.contactUs.connect.title,
    });
    expect(section.className).toContain('es-connect-section');

    const firstCardTitle = screen.getByRole('heading', {
      level: 3,
      name: enContent.contactUs.connect.cards[0].title,
    });
    expect(firstCardTitle.className).toContain('es-connect-card-title');

    const blueGlyph = container.querySelector('span.es-connect-glyph--blue');
    const greenGlyph = container.querySelector('span.es-connect-glyph--green');
    const orangeGlyph = container.querySelector('span.es-connect-glyph--orange');
    expect(blueGlyph).not.toBeNull();
    expect(greenGlyph).not.toBeNull();
    expect(orangeGlyph).not.toBeNull();
    expect(blueGlyph?.querySelector('path')?.getAttribute('stroke')).toBe('currentColor');

    const emailLink = screen.getByRole('link', {
      name: enContent.contactUs.connect.cards[0].ctaLabel,
    });
    expect(emailLink).toHaveAttribute('href', enContent.contactUs.connect.cards[0].ctaHref);
  });
});
