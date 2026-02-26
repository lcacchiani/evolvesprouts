/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { HeroBanner } from '@/components/sections/hero-banner';
import enContent from '@/content/en.json';
import { ROUTES } from '@/lib/routes';

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

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('HeroBanner section', () => {
  it('uses migrated class-based styling and keeps highlighted headline word', () => {
    const { container } = render(<HeroBanner content={enContent.hero} />);

    const section = container.querySelector('section[data-figma-node="banner"]');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('es-hero-section');
    expect(section?.className).toContain('es-section-shell-spacing');

    const frameBackground = container.querySelector('.es-hero-frame-bg');
    expect(frameBackground).not.toBeNull();

    const headline = screen.getByRole('heading', { level: 1 });
    expect(headline.className).toContain('es-hero-headline');
    expect(headline.textContent).toContain('Montessori');
    expect(headline.querySelector('.es-hero-highlight-word')?.textContent).toBe(
      'Montessori',
    );

    const subheadline = screen.getByText(enContent.hero.subheadline);
    expect(subheadline.className).toContain('es-hero-subheadline');

    const cta = screen.getByRole('link', { name: enContent.hero.cta });
    expect(cta).toHaveAttribute('href', ROUTES.servicesMyBestAuntieTrainingCourse);
    const supportingParagraph = screen.getByText(enContent.hero.supportingParagraph);
    expect(supportingParagraph).toBeInTheDocument();
    expect(supportingParagraph.className).toContain('es-hero-subheadline');
  });
});
