import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConsultationsPage } from '@/components/pages/consultations';
import { getContent } from '@/content';

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid='page-layout'>{children}</div>
  ),
}));
vi.mock('@/components/sections/consultations/consultations-hero', () => ({
  ConsultationsHero: ({ content }: { content: { title: string } }) => (
    <section data-testid='consultations-hero'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/consultations/consultations-how-it-works', () => ({
  ConsultationsHowItWorks: ({ content }: { content: { title: string } }) => (
    <section data-testid='consultations-how-it-works'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/consultations/consultations-focus-details', () => ({
  ConsultationsFocusDetails: ({ content }: { content: { title: string } }) => (
    <section data-testid='consultations-focus-details'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/consultations/consultations-comparison', () => ({
  ConsultationsComparison: ({ content }: { content: { title: string } }) => (
    <section data-testid='consultations-comparison'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/faq', () => ({
  Faq: ({ content }: { content: { title: string } }) => (
    <section data-testid='faq'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-intro-session', () => ({
  FreeIntroSession: ({ content }: { content: { title: string } }) => (
    <section data-testid='free-intro-session'>{content.title}</section>
  ),
}));

describe('ConsultationsPage', () => {
  it('assembles the consultations page with all sections in order', () => {
    const content = getContent('en');
    render(<ConsultationsPage content={content} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('consultations-hero')).toBeInTheDocument();
    expect(screen.getByTestId('consultations-how-it-works')).toBeInTheDocument();
    expect(screen.getByTestId('consultations-focus-details')).toBeInTheDocument();
    expect(screen.getByTestId('consultations-comparison')).toBeInTheDocument();
    expect(screen.getByTestId('faq')).toBeInTheDocument();
    expect(screen.getByTestId('free-intro-session')).toBeInTheDocument();

    expect(screen.getByTestId('page-layout').firstElementChild).toHaveAttribute(
      'data-testid',
      'consultations-hero',
    );
    expect(
      screen.getByTestId('consultations-hero').compareDocumentPosition(
        screen.getByTestId('consultations-how-it-works'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('consultations-how-it-works').compareDocumentPosition(
        screen.getByTestId('consultations-focus-details'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('consultations-focus-details').compareDocumentPosition(
        screen.getByTestId('consultations-comparison'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('consultations-comparison').compareDocumentPosition(
        screen.getByTestId('faq'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen.getByTestId('faq').compareDocumentPosition(
        screen.getByTestId('free-intro-session'),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
