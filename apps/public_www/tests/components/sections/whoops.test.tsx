import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Whoops } from '@/components/sections/whoops';
import enContent from '@/content/en.json';

describe('Whoops', () => {
  it('renders the placeholder error code and copy', () => {
    render(<Whoops content={enContent.whoops} />);

    expect(screen.getByText(enContent.whoops.code)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: enContent.whoops.title })).toBeInTheDocument();
    expect(screen.getByText(enContent.whoops.description)).toBeInTheDocument();
  });
});
