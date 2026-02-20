import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BackgroundGlow } from '@/components/shared/background-glow';

describe('BackgroundGlow', () => {
  it('merges required and optional class names into a hidden decorative element', () => {
    const { container } = render(
      <BackgroundGlow
        className='top-0 left-0'
        backgroundClassName='bg-orange-500'
        opacityClassName='opacity-60'
      />,
    );

    const glow = container.querySelector('div');
    expect(glow).not.toBeNull();
    expect(glow).toHaveAttribute('aria-hidden', 'true');
    expect(glow?.className).toContain('pointer-events-none absolute rounded-full');
    expect(glow?.className).toContain('top-0 left-0');
    expect(glow?.className).toContain('bg-orange-500');
    expect(glow?.className).toContain('opacity-60');
  });
});
