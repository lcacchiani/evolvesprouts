import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ContactUsPageSections } from '@/components/pages/contact-us';
import enContent from '@/content/en.json';

const contactUsFormMock = vi.fn(() => <section data-testid='contact-us-form' />);
const reachOutMock = vi.fn(() => <section data-testid='reach-out' />);
const connectMock = vi.fn(() => <section data-testid='connect' />);
const sproutsCommunityMock = vi.fn(() => <section data-testid='sprouts-squad-community' />);

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/contact-us-form', () => ({
  ContactUsForm: contactUsFormMock,
}));
vi.mock('@/components/sections/reach-out', () => ({
  ReachOut: reachOutMock,
}));
vi.mock('@/components/sections/connect', () => ({
  Connect: connectMock,
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: sproutsCommunityMock,
}));

describe('ContactUsPageSections', () => {
  it('composes contact page sections with scoped content props', () => {
    render(<ContactUsPageSections content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('contact-us-form')).toBeInTheDocument();
    expect(screen.getByTestId('reach-out')).toBeInTheDocument();
    expect(screen.getByTestId('connect')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();

    expect(contactUsFormMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.contactUs.contactUsForm,
    });
    expect(reachOutMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.contactUs.reachOut,
    });
  });
});
