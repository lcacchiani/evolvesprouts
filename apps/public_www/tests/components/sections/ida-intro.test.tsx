import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IdaIntro } from '@/components/sections/ida-intro';
import enContent from '@/content/en.json';

describe('IdaIntro', () => {
  it('renders intro copy and CTA with background image styling', () => {
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
    expect(screen.queryByRole('img', { name: content.imageAlt })).not.toBeInTheDocument();
  });
});
