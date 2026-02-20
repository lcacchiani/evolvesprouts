import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ContactUsPageSections } from '@/components/pages/contact-us';
import enContent from '@/content/en.json';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/contact-us-form', () => ({
  ContactUsForm: ({ content }: { content: { title: string } }) => (
    <section data-testid='contact-us-form'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/reach-out', () => ({
  ReachOut: ({ content }: { content: { title: string } }) => (
    <section data-testid='reach-out'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/connect', () => ({
  Connect: ({ content }: { content: { title: string } }) => (
    <section data-testid='connect'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: ({ content }: { content: { heading: string } }) => (
    <section data-testid='sprouts-squad-community'>{content.heading}</section>
  ),
}));

describe('ContactUsPageSections', () => {
  it('composes contact page sections with scoped content props', () => {
    render(<ContactUsPageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('contact-us-form')).toBeInTheDocument();
    expect(screen.getByTestId('reach-out')).toBeInTheDocument();
    expect(screen.getByTestId('connect')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();
    expect(screen.getByText(enContent.contactUs.contactUsForm.title)).toBeInTheDocument();
    expect(screen.getByText(enContent.contactUs.reachOut.title)).toBeInTheDocument();
  });
});
