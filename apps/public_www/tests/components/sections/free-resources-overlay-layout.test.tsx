/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FreeResourcesOverlayLayout } from '@/components/sections/free-resources-overlay-layout';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    ...props
  }: {
    alt?: string;
    fill?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('FreeResourcesOverlayLayout', () => {
  it('renders overlay media, pills, and card placement classes', () => {
    render(
      <FreeResourcesOverlayLayout
        mediaAltText='Family at home'
        mediaTitleLine1='Line one'
        mediaTitleLine2='Line two'
        overlayCardAlignmentClassName='justify-end'
        cardContent={<p>Card body</p>}
      />,
    );

    expect(screen.getByTestId('free-resource-layout')).toHaveAttribute(
      'data-layout',
      'overlay',
    );
    expect(screen.getByAltText('Family at home')).toBeInTheDocument();
    expect(screen.getByText('Line one')).toBeInTheDocument();
    expect(screen.getByText('Line two')).toBeInTheDocument();
    expect(screen.getByText('Card body')).toBeInTheDocument();
    expect(screen.getByTestId('free-resource-overlay-card-wrapper').className).toContain(
      'justify-end',
    );
  });
});
