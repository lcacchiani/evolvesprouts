import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AboutUs } from '@/components/pages/about-us';
import enContent from '@/content/en.json';

const idaMock = vi.fn(() => <section data-testid='ida' />);
const myHistoryMock = vi.fn(() => <section data-testid='my-history' />);
const myJourneyMock = vi.fn(() => <section data-testid='my-journey' />);
const whyUsMock = vi.fn(() => <section data-testid='why-us' />);
const faqMock = vi.fn(() => <section data-testid='faq' />);
const sproutsCommunityMock = vi.fn(() => <section data-testid='sprouts-squad-community' />);

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/ida', () => ({
  Ida: idaMock,
}));
vi.mock('@/components/sections/my-history', () => ({
  MyHistory: myHistoryMock,
}));
vi.mock('@/components/sections/my-journey', () => ({
  MyJourney: myJourneyMock,
}));
vi.mock('@/components/sections/why-us', () => ({
  WhyUs: whyUsMock,
}));
vi.mock('@/components/sections/faq', () => ({
  Faq: faqMock,
}));
vi.mock('@/components/sections/sprouts-squad-community', () => ({
  SproutsSquadCommunity: sproutsCommunityMock,
}));

describe('AboutUs page', () => {
  it('assembles all about page sections', () => {
    render(<AboutUs content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('ida')).toBeInTheDocument();
    expect(screen.getByTestId('my-history')).toBeInTheDocument();
    expect(screen.getByTestId('my-journey')).toBeInTheDocument();
    expect(screen.getByTestId('why-us')).toBeInTheDocument();
    expect(screen.getByTestId('faq')).toBeInTheDocument();
    expect(screen.getByTestId('sprouts-squad-community')).toBeInTheDocument();

    expect(idaMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.ida,
    });
    expect(faqMock.mock.calls[0]?.[0]).toMatchObject({
      content: enContent.faq,
    });
  });
});
