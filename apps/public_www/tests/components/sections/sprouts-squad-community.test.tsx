/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
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

describe('SproutsSquadCommunity section', () => {
  it('uses migrated section/overlay/logo classes and keeps CTA', () => {
    const { container } = render(
      <SproutsSquadCommunity content={enContent.sproutsSquadCommunity} />,
    );

    const section = screen.getByRole('region', {
      name: enContent.sproutsSquadCommunity.heading,
    });
    expect(section.className).toContain('es-sprouts-community-section');

    expect(container.querySelector('.es-sprouts-community-overlay')).not.toBeNull();
    expect(container.querySelector('img.es-sprouts-community-logo')).not.toBeNull();
    expect(
      container.querySelector('.es-section-header')?.className,
    ).toContain('es-section-header--left');

    const heading = screen.getByRole('heading', {
      level: 2,
      name: enContent.sproutsSquadCommunity.heading,
    });
    expect(heading.className).toContain('es-sprouts-community-heading');

    const cta = screen.getByRole('link', {
      name: enContent.sproutsSquadCommunity.ctaLabel,
    });
    expect(cta).toHaveAttribute('href', enContent.sproutsSquadCommunity.ctaHref);
  });
});
