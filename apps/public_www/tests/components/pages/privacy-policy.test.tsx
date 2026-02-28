import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PrivacyPolicyPageSections } from '@/components/pages/privacy-policy';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/privacy-policy', () => ({
  PrivacyPolicy: ({ content }: { content: { title: string } }) => (
    <section data-testid='privacy-policy-section'>{content.title}</section>
  ),
}));

describe('PrivacyPolicyPageSections', () => {
  it('renders the privacy policy section inside shared page layout', () => {
    render(<PrivacyPolicyPageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('privacy-policy-section')).toHaveTextContent(
      enContent.privacyPolicy.title,
    );
  });
});
