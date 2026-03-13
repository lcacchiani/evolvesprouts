/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Ida } from '@/components/sections/ida';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('Ida', () => {
  it('removes mobile top padding while preserving responsive section spacing', () => {
    render(<Ida content={enContent.aboutUs.hero} />);

    const section = document.getElementById('ida');
    expect(section).not.toBeNull();
    expect(section?.className).toContain('pt-0');
    expect(section?.className).toContain('sm:pt-[60px]');
  });

  it('renders hero copy and portrait image without a CTA link', () => {
    const content = enContent.aboutUs.hero;
    render(<Ida content={content} />);

    expect(screen.getByRole('heading', { name: content.title })).toBeInTheDocument();
    expect(screen.getByText(content.subtitle)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /Ida De Gregorio from Evolve Sprouts/i,
      }),
    ).toBeInTheDocument();
  });
});
