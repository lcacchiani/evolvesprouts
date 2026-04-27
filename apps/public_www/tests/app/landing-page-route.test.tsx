import { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enContent from '@/content/en.json';
import easterWorkshopContent from '@/content/landing-pages/easter-2026-montessori-play-coaching-workshop.json';
const mockFetchLandingPageCalendarPayload = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
}));

vi.mock('@/lib/events-data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/events-data')>();
  return {
    ...actual,
    fetchLandingPageCalendarPayload: mockFetchLandingPageCalendarPayload,
  };
});

vi.mock('@/components/shared/structured-data-script', () => ({
  StructuredDataScript: () => null,
}));

vi.mock('@/lib/locale-page', () => ({
  resolveLocalePageContext: vi.fn(async () => ({
    locale: 'en' as const,
    content: enContent,
  })),
  getMenuLabel: vi.fn(() => 'Home'),
}));

vi.mock('@/lib/structured-data', () => ({
  buildBreadcrumbSchema: vi.fn(() => ({})),
  buildLandingPageEventSchema: vi.fn(() => ({})),
}));

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.resetModules();
  mockFetchLandingPageCalendarPayload.mockClear();
});

describe('LandingPageRoute', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.evolvesprouts.com/www');
    vi.stubEnv('NEXT_PUBLIC_WWW_CRM_API_KEY', 'public-crm-key');
  });

  it('derives null hero, booking, and structured data from an empty calendar payload', async () => {
    mockFetchLandingPageCalendarPayload.mockResolvedValue({
      payload: { status: 'success', data: [] },
      lastError: null,
    });

    const { default: LandingPageRoute } = await import('@/app/[locale]/[slug]/page');
    const tree = await LandingPageRoute({
      params: Promise.resolve({
        locale: 'en',
        slug: 'easter-2026-montessori-play-coaching-workshop',
      }),
    });

    expect(mockFetchLandingPageCalendarPayload).toHaveBeenCalledWith({
      slug: 'easter-2026-montessori-play-coaching-workshop',
    });

    expect(isValidElement(tree)).toBe(true);
    const children = (tree as { props?: { children?: ReactNode } }).props?.children;
    const flatChildren = Children.toArray(children);
    const landingPageEl = flatChildren.find(
      (node) =>
        isValidElement(node) &&
        (node.props as { slug?: string }).slug ===
          'easter-2026-montessori-play-coaching-workshop',
    );
    expect(isValidElement(landingPageEl)).toBe(true);
    expect((landingPageEl as { props: Record<string, unknown> }).props).toMatchObject({
      heroEventContent: null,
      bookingEventContent: null,
      pageContent: easterWorkshopContent.en,
    });
  });
});
