/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { IdaIntro } from '@/components/sections/ida-intro';
import enContent from '@/content/en.json';
import zhCNContent from '@/content/zh-CN.json';

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

    const heading = screen.getByRole('heading', { name: content.heading });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole('region', { name: content.heading })).toHaveClass(
      'es-ida-intro-section',
    );
    expect(screen.getByText(content.body)).toBeInTheDocument();
    expect(screen.getByText(content.highlightPhrase)).toHaveClass(
      'es-hero-highlight-word',
    );
    const ctaLink = screen.getByRole('link', { name: content.ctaLabel });
    expect(ctaLink).toHaveAttribute('href', content.ctaHref);
    expect(ctaLink.className).toContain('es-btn--primary');
    expect(ctaLink.className).toContain('es-btn--outline');
    expect(ctaLink.className).toContain('mt-auto');
    expect(ctaLink.className).not.toContain('w-full');
    expect(ctaLink.className).toContain('max-w-[360px]');
    const image = screen.getByRole('img', { name: content.imageAlt });
    expect(image).toBeInTheDocument();
    expect(image).toHaveClass('relative', 'z-10');
    expect(image.closest('div')).toHaveClass('es-ida-intro-image-wrap', 'max-w-[400px]');
  });

  it('applies locale-specific intro highlight phrase styling', () => {
    render(<IdaIntro content={zhCNContent.idaIntro} />);

    expect(screen.getByText(zhCNContent.idaIntro.highlightPhrase)).toHaveClass(
      'es-hero-highlight-word',
    );
  });
});
