import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReachOut } from '@/components/sections/reach-out';
import enContent from '@/content/en.json';

describe('ReachOut', () => {
  it('renders all contact motivation cards with rotating glyph tones', () => {
    const content = enContent.contactUs.reachOut;
    const { container } = render(<ReachOut content={content} />);

    const section = screen.getByRole('region', {
      name: content.title,
    });
    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-reach-out-section');
    expect(container.querySelector('.es-course-highlights-overlay')).not.toBeNull();

    expect(
      screen.getByRole('heading', {
        name: content.title,
      }),
    ).toBeInTheDocument();

    for (const item of content.items) {
      expect(screen.getByRole('heading', { name: item.title })).toBeInTheDocument();
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }

    expect(container.querySelectorAll('.es-reach-out-glyph--orange')).toHaveLength(1);
    expect(container.querySelectorAll('.es-reach-out-glyph--blue')).toHaveLength(1);
    expect(container.querySelectorAll('.es-reach-out-glyph--gold')).toHaveLength(1);
    expect(container.querySelectorAll('.es-reach-out-glyph--green')).toHaveLength(1);
  });
});
