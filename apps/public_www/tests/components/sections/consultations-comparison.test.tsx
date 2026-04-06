import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsultationsComparison } from '@/components/sections/consultations/consultations-comparison';
import enContent from '@/content/en.json';

describe('ConsultationsComparison', () => {
  it('renders service icons, comparison table, italic footnote, and booking CTA', () => {
    const content = enContent.consultations.comparison;

    render(<ConsultationsComparison content={content} />);

    expect(
      screen.getByRole('heading', { name: content.title }),
    ).toBeInTheDocument();

    const essentialsIcon = document.querySelector(
      'img[src="/images/essentials.svg"]',
    );
    const deepDiveIcon = document.querySelector(
      'img[src="/images/deep-dive.svg"]',
    );
    expect(essentialsIcon).not.toBeNull();
    expect(deepDiveIcon).not.toBeNull();

    expect(screen.getByText(content.footnote)).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: content.ctaLabel }),
    ).toHaveAttribute('href', content.ctaHref);
  });
});
