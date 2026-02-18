import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SectionContainer } from '@/components/section-container';

describe('SectionContainer', () => {
  it('renders with the shared layout container class', () => {
    render(
      <SectionContainer data-testid='section-container'>
        Container content
      </SectionContainer>,
    );

    const container = screen.getByTestId('section-container');
    expect(container.className).toContain('es-layout-container');
    expect(container.tagName).toBe('DIV');
  });

  it('supports rendering as nav and merges classes', () => {
    render(
      <SectionContainer
        as='nav'
        className='items-center'
        aria-label='Primary navigation'
      >
        Nav content
      </SectionContainer>,
    );

    const nav = screen.getByRole('navigation', {
      name: 'Primary navigation',
    });
    expect(nav.className).toContain('es-layout-container');
    expect(nav.className).toContain('items-center');
  });
});
