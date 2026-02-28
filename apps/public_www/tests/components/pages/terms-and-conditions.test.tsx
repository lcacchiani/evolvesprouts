import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TermsAndConditionsPageSections } from '@/components/pages/terms-and-conditions';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/terms-and-conditions', () => ({
  TermsAndConditions: ({ content }: { content: { title: string } }) => (
    <section data-testid='terms-section'>{content.title}</section>
  ),
}));

describe('TermsAndConditionsPageSections', () => {
  it('renders terms section inside shared page layout', () => {
    render(<TermsAndConditionsPageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('terms-section')).toHaveTextContent(
      enContent.termsAndConditions.title,
    );
  });
});
