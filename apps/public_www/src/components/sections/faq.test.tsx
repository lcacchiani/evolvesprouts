import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Faq } from '@/components/sections/faq';
import enContent from '@/content/en.json';

describe('Faq section background', () => {
  it('uses the testimonials background image and overlay properties', () => {
    const { container } = render(<Faq content={enContent.faq} />);

    const section = container.querySelector('section[data-figma-node="faq"]');
    expect(
      section,
    ).not.toBeNull();
    expect(section?.className).toContain('es-section-bg-overlay');
    expect(section?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(section?.style.getPropertyValue('--es-section-bg-image')).toContain(
      '/images/evolvesprouts-logo.svg',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-position')).toBe(
      'center -150px',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-size')).toBe(
      '900px auto',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-filter')).toBe(
      'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-mask-image')).toBe(
      'linear-gradient(to bottom, black 18%, transparent 20%)',
    );
    expect(section?.querySelector('div.relative.z-10')).not.toBeNull();
  });
});
