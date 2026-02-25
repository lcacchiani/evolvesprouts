import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: function MockImage(props: ComponentProps<'img'>) {
    return (
      <div
        data-next-image-src={
          typeof props.src === 'string' ? props.src : 'non-string-src'
        }
        data-next-image-alt={props.alt ?? ''}
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
    const mobileCarouselWrapper = container.querySelector('div.-mx-1.md\\:hidden');
    expect(mobileCarouselWrapper).toHaveAttribute(
      'data-css-fallback',
      'hide-when-css-missing',
    );

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
        container.querySelectorAll(
          `div[data-next-image-src="/images/${iconName}.svg"]`,
        ).length,
      ).toBe(2);
    });
    const renderedModuleIconCount = moduleIcons.reduce(
      (count, iconName) =>
        count +
        container.querySelectorAll(
          `div[data-next-image-src="/images/${iconName}.svg"]`,
        ).length,
      0,
    );
    expect(renderedModuleIconCount).toBe(moduleIcons.length * 2);
  });

  it('reveals the desktop card description when clicked', () => {
    const { container } = render(
      <MyBestAuntieOverview content={enContent.myBestAuntieOverview} />,
    );

    const desktopGrid = Array.from(container.querySelectorAll('ul')).find(
      (list) => list.className.includes('md:grid-cols-3'),
    );
    expect(desktopGrid).not.toBeUndefined();

    const firstCard = desktopGrid?.querySelector('article');
    expect(firstCard).not.toBeNull();
    expect(firstCard?.getAttribute('role')).toBe('button');

    const description = firstCard?.querySelector(
      'p.es-my-best-auntie-overview-activity',
    );
    const countLine = firstCard?.querySelector(
      'span.es-my-best-auntie-overview-count-line',
    );
    expect(description).not.toBeNull();
    expect(countLine).not.toBeNull();
    expect(description?.className).toContain('opacity-0');
    expect(countLine?.className).toContain('h-[148px]');
    expect(countLine?.className).toContain('-top-[144px]');

    fireEvent.click(firstCard!);
    expect(description?.className).toContain('opacity-100');
    expect(countLine?.className).toContain('h-[74px]');
    expect(countLine?.className).toContain('-top-[70px]');
    expect(countLine?.className).not.toContain('h-[148px]');

    fireEvent.click(firstCard!);
    expect(description?.className).toContain('opacity-0');
    expect(countLine?.className).toContain('h-[148px]');
    expect(countLine?.className).toContain('-top-[144px]');
  });
});
