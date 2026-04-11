import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMatchMedia } from '@/lib/hooks/use-match-media';

const originalMatchMedia = window.matchMedia;

function Harness({ query }: { query: string }) {
  const matches = useMatchMedia(query);
  return <span data-testid='state'>{matches ? 'true' : 'false'}</span>;
}

afterEach(() => {
  if (originalMatchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    return;
  }

  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useMatchMedia', () => {
  it('reflects initial matchMedia result on first render', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(min-width: 1px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { rerender } = render(<Harness query='(min-width: 1px)' />);
    expect(screen.getByTestId('state')).toHaveTextContent('true');

    rerender(<Harness query='(min-width: 99999px)' />);
    await waitFor(() => {
      expect(screen.getByTestId('state')).toHaveTextContent('false');
    });
  });
});
