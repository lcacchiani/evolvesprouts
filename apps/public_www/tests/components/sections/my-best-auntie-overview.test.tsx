import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import enContent from '@/content/en.json';

describe('MyBestAuntieOverview section', () => {
  it('uses migrated section and module tone classes', () => {
    const { container } = render(
      <MyBestAuntieOverview content={enContent.myBestAuntieOverview} />,
    );

    const section = screen.getByRole('region', {
      name: /best auntie training/i,
    });
    expect(section.className).toContain('es-my-best-auntie-overview-section');

    const moduleTitles = enContent.myBestAuntieOverview.modules.map(
      (module) => module.title,
    );

    moduleTitles.forEach((title) => {
      const headings = screen.getAllByRole('heading', {
        level: 3,
        name: title,
      });
      expect(headings.length).toBeGreaterThan(0);
      headings.forEach((heading) => {
        expect(heading.className).toContain('es-my-best-auntie-overview-module-title');
      });
    });

    expect(container.querySelector('article.es-my-best-auntie-overview-card--gold')).not.toBeNull();
    expect(container.querySelector('article.es-my-best-auntie-overview-card--red')).not.toBeNull();
    expect(container.querySelector('article.es-my-best-auntie-overview-card--blue')).not.toBeNull();
    expect(
      container.querySelector('span.es-my-best-auntie-overview-count-line--gold'),
    ).not.toBeNull();
    expect(
      container.querySelector('span.es-my-best-auntie-overview-count-text--red'),
    ).not.toBeNull();
    expect(
      container.querySelector('span.es-my-best-auntie-overview-count-text--blue'),
    ).not.toBeNull();
  });
});
