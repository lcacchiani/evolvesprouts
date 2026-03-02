import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FreeResourcesSplitLayout } from '@/components/sections/free-resources-split-layout';

describe('FreeResourcesSplitLayout', () => {
  it('renders split panes with provided order and bleed classes', () => {
    render(
      <FreeResourcesSplitLayout
        mediaTitleLine1='Teach Patience'
        mediaTitleLine2='to Young Children'
        splitTextPaneOrderClassName='lg:order-2'
        splitMediaPaneOrderClassName='lg:order-1'
        splitMediaBleedClassName='es-free-resources-media-pane--bleed-right'
        cardContent={<p>Split card content</p>}
      />,
    );

    expect(screen.getByTestId('free-resource-layout')).toHaveAttribute(
      'data-layout',
      'split',
    );
    expect(screen.getByTestId('free-resource-text-pane').className).toContain(
      'lg:order-2',
    );
    expect(screen.getByTestId('free-resource-media-pane').className).toContain(
      'lg:order-1',
    );
    expect(screen.getByTestId('free-resource-media-pane').className).toContain(
      'es-free-resources-media-pane--bleed-right',
    );
    const mediaPillStack =
      screen.getByText('Teach Patience').parentElement?.parentElement;
    expect(mediaPillStack?.className).toContain('top-[50%]');
    expect(mediaPillStack?.className).toContain('sm:top-[10%]');
    expect(screen.getByText('Teach Patience')).toBeInTheDocument();
    expect(screen.getByText('to Young Children')).toBeInTheDocument();
    expect(screen.getByText('Split card content')).toBeInTheDocument();
  });
});
