/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyJourney } from '@/components/sections/my-journey';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    fill?: boolean;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('MyJourney section', () => {
  it('uses testimonials overlay properties and renders the www2 journey image', () => {
    render(<MyJourney content={enContent.myJourney} />);

    const section = screen.getByRole('region', {
      name: enContent.myJourney.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(section.style.getPropertyValue('--es-section-bg-image')).toContain(
      '/images/evolvesprouts-logo.svg',
    );
    expect(section.style.getPropertyValue('--es-section-bg-position')).toBe(
      'center -150px',
    );
    expect(section.style.getPropertyValue('--es-section-bg-size')).toBe(
      '900px auto',
    );
    expect(section.style.getPropertyValue('--es-section-bg-filter')).toBe(
      'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)',
    );
    expect(section.style.getPropertyValue('--es-section-bg-mask-image')).toBe(
      'linear-gradient(to bottom, black 18%, transparent 20%)',
    );

    const image = screen.getByRole('img', {
      name: /my montessori journey section image/i,
    });
    expect(image).toHaveAttribute(
      'src',
      'https://www2.evolvesprouts.com/wp-content/uploads/2025/10/Rectangle-240648668.png',
    );
  });
});
