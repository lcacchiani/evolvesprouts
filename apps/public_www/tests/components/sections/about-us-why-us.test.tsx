import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AboutUsWhyUs } from '@/components/sections/about-us-why-us';
import enContent from '@/content/en.json';

describe('AboutUsWhyUs section', () => {
  it('uses the section background treatment without the removed split layout', () => {
    const { container } = render(<AboutUsWhyUs locale='en' content={enContent.aboutUs.whyUs} />);

    const section = screen.getByRole('region', {
      name: enContent.aboutUs.whyUs.title,
    });
    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-why-us-section');
    expect(container.querySelector('.es-section-brand-overlay')).not.toBeNull();
    expect(container.querySelector('.es-section-split-layout--why-us')).toBeNull();
    expect(container.querySelector('.es-why-us-hero-card')).toBeNull();
    expect(container.querySelector('.es-why-us-glow-orange')).toBeNull();
    expect(container.querySelector('.es-why-us-glow-green')).toBeNull();
  });

  it('renders pillar cards and a section-level localized services cta', () => {
    const { container } = render(<AboutUsWhyUs locale='en' content={enContent.aboutUs.whyUs} />);

    const description = screen.getByText(enContent.aboutUs.whyUs.description);
    expect(description.className).toContain('es-section-body');

    const firstPillarTitle = screen.getByRole('heading', {
      level: 3,
      name: enContent.aboutUs.whyUs.pillars[0].title,
    });
    expect(firstPillarTitle.className).toContain('es-type-subtitle');

    const servicesLink = screen.getByRole('link', {
      name: enContent.aboutUs.whyUs.ctaLabel,
    });
    expect(servicesLink).toHaveAttribute('href', '/en#services');
    expect(container.querySelector('ul')?.contains(servicesLink)).toBe(false);

    const firstPillarCard = container.querySelector('ul > li:first-child article');
    expect(firstPillarCard).not.toBeNull();
    expect(
      within(firstPillarCard as HTMLElement).queryByRole('link', {
        name: enContent.aboutUs.whyUs.ctaLabel,
      }),
    ).toBeNull();

    for (const pillar of enContent.aboutUs.whyUs.pillars) {
      expect(screen.getByText(pillar.title)).toBeInTheDocument();
      expect(screen.getByText(pillar.description)).toBeInTheDocument();
    }
  });
});
