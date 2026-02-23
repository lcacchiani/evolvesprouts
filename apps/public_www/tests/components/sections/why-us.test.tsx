/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WhyUs } from '@/components/sections/why-us';
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

describe('WhyUs section', () => {
  it('uses migrated background, overlay, and glow classes', () => {
    const { container } = render(<WhyUs content={enContent.whyUs} />);

    const section = screen.getByRole('region', {
      name: enContent.whyUs.title,
    });
    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-why-us-section');
    expect(container.querySelector('.es-course-highlights-overlay')).not.toBeNull();

    expect(container.querySelector('.es-why-us-hero-card')).not.toBeNull();
    expect(container.querySelector('.es-why-us-glow-orange')).not.toBeNull();
    expect(container.querySelector('.es-why-us-glow-green')).not.toBeNull();
  });

  it('applies migrated title classes for intro and pillars', () => {
    render(<WhyUs content={enContent.whyUs} />);

    const introTitle = screen.getByRole('heading', {
      level: 3,
      name: enContent.whyUs.introTitle,
    });
    expect(introTitle.className).toContain('es-why-us-intro-title');

    const firstPillarTitle = screen.getByRole('heading', {
      level: 3,
      name: enContent.whyUs.pillars[0].title,
    });
    expect(firstPillarTitle.className).toContain('es-why-us-pillar-title');
    expect(firstPillarTitle.className).toContain('es-type-subtitle');
  });
});
