/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MyHistory } from '@/components/sections/my-history';
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

describe('MyHistory section', () => {
  it('uses course highlights overlay properties with the grey background', () => {
    render(<MyHistory content={enContent.myHistory} />);

    const section = screen.getByRole('region', {
      name: enContent.myHistory.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.style.backgroundColor).toBe('rgb(248, 248, 248)');
    expect(section.style.getPropertyValue('--es-section-bg-image')).toContain(
      '/images/evolvesprouts-logo.svg',
    );
    expect(section.style.getPropertyValue('--es-section-bg-position')).toBe(
      'center -900px',
    );
    expect(section.style.getPropertyValue('--es-section-bg-size')).toBe(
      '2000px auto',
    );
    expect(section.style.getPropertyValue('--es-section-bg-filter')).toBe(
      'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)',
    );
    expect(section.style.getPropertyValue('--es-section-bg-mask-image')).toBe(
      'linear-gradient(to bottom, black 5%, transparent 15%)',
    );
  });
});
