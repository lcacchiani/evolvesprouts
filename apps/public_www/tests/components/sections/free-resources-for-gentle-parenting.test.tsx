/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FreeResourcesForGentleParenting } from '@/components/sections/free-resources-for-gentle-parenting';
import type { ResourcesContent } from '@/content';
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

function createResourcesContent(
  sectionConfig: Record<string, string>,
): ResourcesContent {
  const clonedContent = JSON.parse(
    JSON.stringify(enContent.resources),
  ) as ResourcesContent & {
    sectionConfig?: Record<string, string>;
  };
  clonedContent.sectionConfig = sectionConfig;

  return clonedContent;
}

describe('Free resources for gentle parenting section', () => {
  it('uses center heading and split layout defaults', () => {
    render(<FreeResourcesForGentleParenting content={enContent.resources} />);

    const header = screen.getByTestId('free-resource-header');
    const layout = screen.getByTestId('free-resource-layout');
    const textPane = screen.getByTestId('free-resource-text-pane');
    const mediaPane = screen.getByTestId('free-resource-media-pane');

    expect(header.className).toContain('text-center');
    expect(layout).toHaveAttribute('data-layout', 'split');
    expect(textPane.className).toContain('z-0');
    expect(mediaPane.className).toContain('z-10');
    expect(mediaPane.className).toContain('lg:order-2');
  });

  it('applies the orange tile background pattern to the card container', () => {
    const { container, rerender } = render(
      <FreeResourcesForGentleParenting content={enContent.resources} />,
    );

    const layout = screen.getByTestId('free-resource-layout');
    const mediaPane = screen.getByTestId('free-resource-media-pane');
    const splitArticle = container.querySelector('article');

    expect(layout.className).toContain('es-free-resources-pattern-bg');
    expect(mediaPane.style.backgroundColor).toBe('');
    expect(splitArticle?.getAttribute('style')).toBeNull();
    expect(splitArticle?.className).not.toContain('isolate');

    const overlayContent = createResourcesContent({
      headerAlignment: 'center',
      layoutVariant: 'overlay',
      imagePosition: 'right',
      cardPosition: 'right',
    });
    rerender(<FreeResourcesForGentleParenting content={overlayContent} />);

    const overlayLayout = screen.getByTestId('free-resource-layout');
    const overlayMediaPane = screen.getByTestId('free-resource-media-pane');
    const overlayArticle = container.querySelector('article');

    expect(overlayLayout.className).toContain('es-free-resources-pattern-bg');
    expect(overlayMediaPane.style.backgroundColor).toBe('');
    expect(overlayArticle?.getAttribute('style')).toBeNull();
    expect(overlayArticle?.className).not.toContain('isolate');
  });

  it('does not render the circular play-arrow overlay on the media image', () => {
    const playIconPathSelector = 'path[d="M12 9.8L23 16L12 22.2V9.8Z"]';
    const { container, rerender } = render(
      <FreeResourcesForGentleParenting content={enContent.resources} />,
    );

    expect(container.querySelector(playIconPathSelector)).toBeNull();

    const overlayContent = createResourcesContent({
      headerAlignment: 'center',
      layoutVariant: 'overlay',
      imagePosition: 'right',
      cardPosition: 'right',
    });
    rerender(<FreeResourcesForGentleParenting content={overlayContent} />);

    expect(container.querySelector(playIconPathSelector)).toBeNull();
  });

  it('renders checklist list items with white rounded backgrounds', () => {
    const { container } = render(
      <FreeResourcesForGentleParenting content={enContent.resources} />,
    );

    const checklistList = container.querySelector('ul');
    const checklistItems = container.querySelectorAll('li');
    expect(checklistList?.className).toContain('mt-7');
    expect(checklistList?.className).toContain('mb-7');
    expect(checklistItems.length).toBeGreaterThan(0);
    checklistItems.forEach((item) => {
      expect(item.className).toContain('rounded-[12px]');
      expect(item.className).toContain('bg-white');
    });
  });

  it('supports left heading alignment from locale config', () => {
    const content = createResourcesContent({
      headerAlignment: 'left',
      layoutVariant: 'split',
      imagePosition: 'right',
      cardPosition: 'left',
    });

    render(<FreeResourcesForGentleParenting content={content} />);

    const header = screen.getByTestId('free-resource-header');
    expect(header.className).toContain('text-left');
    expect(header.className).not.toContain('text-center');
  });

  it('supports split layout with image on the left', () => {
    const content = createResourcesContent({
      headerAlignment: 'center',
      layoutVariant: 'split',
      imagePosition: 'left',
      cardPosition: 'left',
    });

    render(<FreeResourcesForGentleParenting content={content} />);

    const layout = screen.getByTestId('free-resource-layout');
    const textPane = screen.getByTestId('free-resource-text-pane');
    const mediaPane = screen.getByTestId('free-resource-media-pane');

    expect(layout).toHaveAttribute('data-layout', 'split');
    expect(textPane.className).toContain('lg:order-2');
    expect(mediaPane.className).toContain('lg:order-1');
  });

  it('supports overlay layout with right-positioned text card', () => {
    const content = createResourcesContent({
      headerAlignment: 'center',
      layoutVariant: 'overlay',
      imagePosition: 'right',
      cardPosition: 'right',
    });

    render(<FreeResourcesForGentleParenting content={content} />);

    const layout = screen.getByTestId('free-resource-layout');
    const overlayWrapper = screen.getByTestId(
      'free-resource-overlay-card-wrapper',
    );

    expect(layout).toHaveAttribute('data-layout', 'overlay');
    expect(overlayWrapper.className).toContain('justify-end');
  });

  it('falls back to defaults when config values are invalid', () => {
    const content = createResourcesContent({
      headerAlignment: 'middle',
      layoutVariant: 'stacked',
      imagePosition: 'top',
      cardPosition: 'middle',
    });

    render(<FreeResourcesForGentleParenting content={content} />);

    const header = screen.getByTestId('free-resource-header');
    const layout = screen.getByTestId('free-resource-layout');

    expect(header.className).toContain('text-center');
    expect(layout).toHaveAttribute('data-layout', 'split');
  });
});
