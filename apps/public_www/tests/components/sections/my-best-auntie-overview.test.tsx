import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: function MockImage(props: ComponentProps<'img'>) {
    return (
      <img
        src={typeof props.src === 'string' ? props.src : 'non-string-src'}
        alt={props.alt ?? ''}
        className={props.className}
      />
    );
  },
}));

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

    const moduleIcons = enContent.myBestAuntieOverview.modules.map(
      (module) => module.icon,
    );
    moduleIcons.forEach((iconName) => {
      expect(
        container.querySelectorAll(`img[src="/images/${iconName}.svg"]`).length,
      ).toBe(2);
    });
    const renderedModuleIconCount = moduleIcons.reduce(
      (count, iconName) =>
        count +
        container.querySelectorAll(`img[src="/images/${iconName}.svg"]`).length,
      0,
    );
    expect(renderedModuleIconCount).toBe(moduleIcons.length * 2);
  });
});
