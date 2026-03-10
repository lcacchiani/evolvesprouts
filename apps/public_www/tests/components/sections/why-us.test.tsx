import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WhyUs } from '@/components/sections/why-us';
import enContent from '@/content/en.json';

describe('WhyUs section', () => {
  it('uses the section background treatment without the removed split layout', () => {
    const { container } = render(<WhyUs locale='en' content={enContent.whyUs} />);

    const section = screen.getByRole('region', {
      name: enContent.whyUs.title,
    });
    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-why-us-section');
    expect(container.querySelector('.es-course-highlights-overlay')).not.toBeNull();
    expect(container.querySelector('.es-section-split-layout--why-us')).toBeNull();
    expect(container.querySelector('.es-why-us-hero-card')).toBeNull();
    expect(container.querySelector('.es-why-us-glow-orange')).toBeNull();
    expect(container.querySelector('.es-why-us-glow-green')).toBeNull();
  });

  it('renders the new description, localized workshops cta, and pillar cards', () => {
    render(<WhyUs locale='en' content={enContent.whyUs} />);

    const description = screen.getByText(enContent.whyUs.description);
    expect(description.className).toContain('es-section-body');

    const firstPillarTitle = screen.getByRole('heading', {
      level: 3,
      name: enContent.whyUs.pillars[0].title,
    });
    expect(firstPillarTitle.className).toContain('es-type-subtitle');

    const workshopsLink = screen.getByRole('link', {
      name: enContent.whyUs.ctaLabel,
    });
    expect(workshopsLink).toHaveAttribute('href', '/en/services/workshops');

    for (const pillar of enContent.whyUs.pillars) {
      expect(screen.getByText(pillar.title)).toBeInTheDocument();
      expect(screen.getByText(pillar.description)).toBeInTheDocument();
    }
  });
});
