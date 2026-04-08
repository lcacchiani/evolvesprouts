import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsultationsComparison } from '@/components/sections/consultations/consultations-comparison';
import enContent from '@/content/en.json';

describe('ConsultationsComparison', () => {
  it('renders service icons, comparison table with detail rows and check/cross icons, footnote, and booking CTA', () => {
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

    const expectedCheckCount = content.rows.reduce(
      (n, r) => n + (r.essentials ? 1 : 0) + (r.deepDive ? 1 : 0),
      0,
    );
    const expectedCrossCount = content.rows.reduce(
      (n, r) => n + (r.essentials ? 0 : 1) + (r.deepDive ? 0 : 1),
      0,
    );
    expect(
      document.querySelectorAll('img[src="/images/comparison-check.svg"]')
        .length,
    ).toBe(expectedCheckCount);
    expect(
      document.querySelectorAll('img[src="/images/comparison-cross.svg"]')
        .length,
    ).toBe(expectedCrossCount);

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows).toHaveLength(content.rows.length);

    content.rows.forEach((row, index) => {
      const tr = dataRows[index];
      expect(within(tr).getByText(row.label)).toBeInTheDocument();
      expect(within(tr).getByText(row.detail)).toBeInTheDocument();
      expect(typeof row.essentials).toBe('boolean');
      expect(typeof row.deepDive).toBe('boolean');
    });

    expect(
      screen.getAllByRole('img', { name: content.includedAlt }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('img', { name: content.notIncludedAlt }).length,
    ).toBeGreaterThan(0);

    expect(screen.getByText(content.footnote)).toBeInTheDocument();

    expect(
      screen.getByRole('link', { name: content.ctaLabel }),
    ).toHaveAttribute('href', content.ctaHref);
  });
});
