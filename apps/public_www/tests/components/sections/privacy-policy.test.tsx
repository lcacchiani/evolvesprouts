import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrivacyPolicy } from '@/components/sections/privacy-policy';
import enContent from '@/content/en.json';

describe('PrivacyPolicy section', () => {
  it('renders title and all configured policy section headings', () => {
    render(<PrivacyPolicy content={enContent.privacyPolicy} />);

    expect(
      screen.getByRole('heading', { name: enContent.privacyPolicy.title }),
    ).toBeInTheDocument();

    for (const section of enContent.privacyPolicy.sections) {
      expect(
        screen.getByRole('heading', { name: section.heading }),
      ).toBeInTheDocument();
    }
  });
});
