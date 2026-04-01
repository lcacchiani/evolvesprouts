import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FreeGuidesAndResourcesHero } from '@/components/sections/free-guides-and-resources-hero';
import enContent from '@/content/en.json';

describe('FreeGuidesAndResourcesHero', () => {
  it('renders hero with h1, subtitle, and description', () => {
    const content = enContent.freeGuidesAndResources.hero;
    const { container } = render(<FreeGuidesAndResourcesHero content={content} />);

    const section = container.querySelector(
      'section[data-figma-node="free-guides-and-resources-hero"]',
    );
    expect(section).not.toBeNull();
    expect(section?.id).toBe('free-guides-and-resources-hero');
    expect(section?.className).toContain('es-free-guides-and-resources-hero-section');

    expect(
      screen.getByRole('region', { name: content.title }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { level: 1, name: content.title }),
    ).toBeInTheDocument();

    expect(screen.getByText(content.subtitle)).toBeInTheDocument();
    expect(screen.getByText(content.description)).toBeInTheDocument();
  });
});
