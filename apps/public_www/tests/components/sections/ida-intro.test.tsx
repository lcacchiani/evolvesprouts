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
  it('renders intro copy, CTA, and portrait image', () => {
    const content = enContent.idaIntro;
    render(<IdaIntro content={content} />);

    expect(screen.getByRole('heading', { name: content.text })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: content.ctaLabel })).toHaveAttribute(
      'href',
      content.ctaHref,
    );
    expect(screen.getByRole('img', { name: content.imageAlt })).toBeInTheDocument();
  });
});
