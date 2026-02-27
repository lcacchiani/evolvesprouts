import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TermsAndConditions } from '@/components/sections/terms-and-conditions';
import enContent from '@/content/en.json';

describe('TermsAndConditions section', () => {
  it('renders title, sections, and language precedence clause', () => {
    render(<TermsAndConditions content={enContent.termsAndConditions} />);

    expect(
      screen.getByRole('heading', { name: enContent.termsAndConditions.title }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enContent.termsAndConditions.languagePrevailsClause),
    ).toBeInTheDocument();

    for (const section of enContent.termsAndConditions.sections) {
      expect(
        screen.getByRole('heading', { name: section.heading }),
      ).toBeInTheDocument();
    }
  });
});
