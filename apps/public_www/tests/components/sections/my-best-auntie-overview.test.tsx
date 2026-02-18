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
    const toneClasses = [
      'es-my-best-auntie-overview-card--gold',
      'es-my-best-auntie-overview-card--red',
      'es-my-best-auntie-overview-card--blue',
    ] as const;

    moduleTitles.forEach((title, index) => {
      const heading = screen.getByRole('heading', {
        level: 3,
        name: title,
      });
      expect(heading.className).toContain('es-my-best-auntie-overview-module-title');

      const card = heading.closest('article');
      expect(card).not.toBeNull();
      expect(card?.className).toContain(toneClasses[index] ?? toneClasses[0]);
    });

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
