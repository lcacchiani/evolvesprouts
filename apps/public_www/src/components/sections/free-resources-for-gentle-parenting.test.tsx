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
    const mediaPane = screen.getByTestId('free-resource-media-pane');

    expect(header.className).toContain('text-center');
    expect(layout).toHaveAttribute('data-layout', 'split');
    expect(mediaPane.className).toContain('lg:order-2');
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
