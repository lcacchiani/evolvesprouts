import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyPagePlaceholder } from '@/components/pages/empty-page-placeholder';

describe('EmptyPagePlaceholder', () => {
  it('renders the provided placeholder title', () => {
    render(<EmptyPagePlaceholder title='Coming Soon' />);

    expect(screen.getByRole('heading', { name: 'Coming Soon' })).toBeInTheDocument();
  });
});
