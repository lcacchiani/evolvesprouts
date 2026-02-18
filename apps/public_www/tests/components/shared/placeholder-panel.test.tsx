import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlaceholderPanel } from '@/components/shared/placeholder-panel';

describe('PlaceholderPanel', () => {
  it('renders with shared placeholder shell classes', () => {
    render(
      <PlaceholderPanel>
        Placeholder content
      </PlaceholderPanel>,
    );

    const panel = screen.getByText('Placeholder content').closest('section');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain('rounded-2xl');
    expect(panel?.className).toContain('bg-white/70');
    expect(panel?.className).toContain('shadow-sm');
  });
});
