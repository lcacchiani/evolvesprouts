import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NotFound from '@/app/not-found';

describe('NotFound', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('links the logo to the public website home when origin is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_PUBLIC_WWW_ORIGIN', 'https://www.evolvesprouts.com');

    render(<NotFound />);

    const link = screen.getByRole('link', { name: 'Go to the Evolve Sprouts website' });
    expect(link).toHaveAttribute('href', 'https://www.evolvesprouts.com/en/');
    expect(screen.getByRole('img', { name: 'Evolve Sprouts' })).toBeInTheDocument();
  });

  it('renders the logo without a link when public origin is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_PUBLIC_WWW_ORIGIN', '');

    render(<NotFound />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('img', { name: 'Evolve Sprouts' })).toBeInTheDocument();
  });
});
