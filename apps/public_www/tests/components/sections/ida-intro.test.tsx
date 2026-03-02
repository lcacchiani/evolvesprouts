/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdaIntro } from '@/components/sections/ida-intro';
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

describe('IdaIntro', () => {
  it('renders intro copy, CTA, and hero-style image column', () => {
    const content = enContent.idaIntro;
    render(<IdaIntro content={content} />);

    const heading = screen.getByRole('heading', { name: content.text });
    expect(heading).toBeInTheDocument();
    expect(heading.querySelector('.font-normal')).not.toBeNull();
    expect(screen.getByRole('region', { name: content.text })).toHaveClass(
      'es-ida-intro-section',
    );
    expect(screen.getByText('Evolve Sprouts')).toHaveClass('es-hero-highlight-word');
    expect(screen.getByRole('link', { name: content.ctaLabel })).toHaveAttribute(
      'href',
      content.ctaHref,
    );
    const image = screen.getByRole('img', { name: content.imageAlt });
    expect(image).toBeInTheDocument();
    expect(image).toHaveClass('relative', 'z-10');
    expect(image.closest('div')).toHaveClass('es-ida-intro-image-wrap', 'max-w-[400px]');
  });
});
