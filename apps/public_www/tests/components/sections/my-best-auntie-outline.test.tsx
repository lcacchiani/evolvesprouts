import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MyBestAuntieOutline } from '@/components/sections/my-best-auntie/my-best-auntie-outline';
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

describe('MyBestAuntieOutline section', () => {
  it('uses migrated section and module tone classes', () => {
    const { container } = render(
      <MyBestAuntieOutline content={enContent.myBestAuntieOutline} />,
    );

    const section = screen
      .getAllByRole('region', {
        name: /best auntie training/i,
      })
      .find((element) => element.tagName.toLowerCase() === 'section');

    expect(section).toBeDefined();
    expect(section?.className).toContain('es-my-best-auntie-outline-section');
    const mobileCarouselWrapper = container.querySelector('div.md\\:hidden');
    expect(mobileCarouselWrapper).toHaveAttribute(
      'data-css-fallback',
      'hide-when-css-missing',
    );
    const carouselTrack = mobileCarouselWrapper?.querySelector('[aria-roledescription="carousel"]');
    expect(carouselTrack).not.toBeNull();
    expect(carouselTrack?.className).toContain('snap-mandatory');
    expect(carouselTrack?.className).toContain('overflow-x-auto');

    const moduleTitles = enContent.myBestAuntieOutline.modules.map(
      (module) => module.title,
    );

    moduleTitles.forEach((title) => {
      const headings = screen.getAllByRole('heading', {
        level: 3,
        name: title,
      });
      expect(headings.length).toBeGreaterThan(0);
      headings.forEach((heading) => {
        expect(heading.className).toContain('es-my-best-auntie-outline-module-title');
      });
    });
    expect(
      screen.getByText(enContent.myBestAuntieOutline.subtitle),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enContent.myBestAuntieOutline.description),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: enContent.myBestAuntieOutline.ctaLabel,
      }),
    ).toHaveAttribute('href', enContent.myBestAuntieOutline.ctaHref);

    expect(container.querySelector('article.es-my-best-auntie-outline-card--gold')).not.toBeNull();
    expect(container.querySelector('article.es-my-best-auntie-outline-card--red')).not.toBeNull();
    expect(container.querySelector('article.es-my-best-auntie-outline-card--blue')).not.toBeNull();
    expect(
      container.querySelector('span.es-my-best-auntie-outline-count-line--gold'),
    ).not.toBeNull();
    expect(
      container.querySelector('span.es-my-best-auntie-outline-count-text--red'),
    ).not.toBeNull();
    expect(
      container.querySelector('span.es-my-best-auntie-outline-count-text--blue'),
    ).not.toBeNull();

    const moduleIcons = enContent.myBestAuntieOutline.modules.map(
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
      <MyBestAuntieOutline content={enContent.myBestAuntieOutline} />,
    );

    const desktopGrid = Array.from(container.querySelectorAll('ul')).find(
      (list) => list.className.includes('md:grid-cols-3'),
    );
    expect(desktopGrid).not.toBeUndefined();

    const firstCard = desktopGrid?.querySelector('article');
    expect(firstCard).not.toBeNull();
    expect(firstCard?.getAttribute('role')).toBe('button');

    const description = firstCard?.querySelector(
      '.es-my-best-auntie-outline-activity',
    );
    const countLine = firstCard?.querySelector(
      'span.es-my-best-auntie-outline-count-line',
    );
    expect(description).not.toBeNull();
    expect(countLine).not.toBeNull();
    expect(description?.className).toContain('max-h-[92px]');
    expect(description?.className).toContain('overflow-hidden');
    expect(countLine?.className).toContain('h-[148px]');
    expect(countLine?.className).toContain('-top-[144px]');

    fireEvent.click(firstCard!);
    expect(description?.className).not.toContain('max-h-[92px]');
    expect(description?.className).not.toContain('overflow-hidden');
    expect(countLine?.className).toContain('h-[74px]');
    expect(countLine?.className).toContain('-top-[70px]');
    expect(countLine?.className).not.toContain('h-[148px]');

    fireEvent.click(firstCard!);
    expect(description?.className).toContain('max-h-[92px]');
    expect(description?.className).toContain('overflow-hidden');
    expect(countLine?.className).toContain('h-[148px]');
    expect(countLine?.className).toContain('-top-[144px]');
  });

  it('renders three key points per module without visible bullet glyphs', () => {
    const { container } = render(
      <MyBestAuntieOutline content={enContent.myBestAuntieOutline} />,
    );

    const desktopGrid = Array.from(container.querySelectorAll('ul')).find(
      (list) => list.className.includes('md:grid-cols-3'),
    );
    expect(desktopGrid).not.toBeUndefined();

    const firstCard = desktopGrid?.querySelector('article');
    expect(firstCard).not.toBeNull();

    const activityPoints = firstCard?.querySelectorAll(
      '.es-my-best-auntie-outline-activity-point',
    );
    const activityContainer = firstCard?.querySelector(
      '.es-my-best-auntie-outline-activity',
    );
    expect(activityPoints).not.toBeUndefined();
    expect(activityContainer?.className).toContain('text-left');
    expect(activityPoints?.length).toBe(3);
    activityPoints?.forEach((point) => {
      expect(point.textContent?.includes('•')).toBe(false);
    });

    const firstPointLabel = activityPoints?.[0]?.querySelector('strong');
    expect(firstPointLabel).not.toBeNull();
    expect(firstPointLabel?.textContent).toBe('Group session:');

    const summary = firstCard?.querySelector(
      '.es-my-best-auntie-outline-activity-summary',
    );
    expect(summary).not.toBeNull();
    expect(summary?.className).toContain('italic');
  });
});
