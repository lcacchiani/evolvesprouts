/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Ida } from '@/components/sections/ida';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('Ida', () => {
  it('renders hero copy, CTA, and portrait image', () => {
    const content = enContent.ida;
    render(<Ida content={content} />);

    expect(screen.getByRole('heading', { name: content.title })).toBeInTheDocument();
    expect(screen.getByText(content.subtitle)).toBeInTheDocument();
    expect(screen.getByText(content.description)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: content.ctaLabel })).toHaveAttribute(
      'href',
      content.ctaHref,
    );
    expect(
      screen.getByRole('img', {
        name: /Ida De Gregorio from Evolve Sprouts/i,
      }),
    ).toBeInTheDocument();
  });
});
