import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePageSections } from '@/components/pages/homepage';
import enContent from '@/content/en.json';
import zhHKContent from '@/content/zh-HK.json';

const WHATSAPP_URL_ENV_KEY = 'NEXT_PUBLIC_WHATSAPP_URL';
const BUSINESS_PHONE_ENV_KEY = 'NEXT_PUBLIC_BUSINESS_PHONE_NUMBER';
const originalWhatsappUrlEnv = process.env[WHATSAPP_URL_ENV_KEY];
const originalBusinessPhoneEnv = process.env[BUSINESS_PHONE_ENV_KEY];

afterEach(() => {
  if (typeof originalWhatsappUrlEnv === 'string') {
    process.env[WHATSAPP_URL_ENV_KEY] = originalWhatsappUrlEnv;
  } else {
    delete process.env[WHATSAPP_URL_ENV_KEY];
  }

  if (typeof originalBusinessPhoneEnv === 'string') {
    process.env[BUSINESS_PHONE_ENV_KEY] = originalBusinessPhoneEnv;
  } else {
    delete process.env[BUSINESS_PHONE_ENV_KEY];
  }
});

const heroBannerPropsSpy = vi.fn<
  [{ content: { headline: string }; ctaHref?: string }],
  void
>();
const pageLayoutPropsSpy = vi.fn<
  [{ navbarContent: { bookNow: { href: string; label: string } } }],
  void
>();
const freeIntroSessionPropsSpy = vi.fn<
  [{ content: { heading: string }; ctaHref: string }],
  void
>();

vi.mock('@/components/shared/page-layout', () => ({
  PageLayout: ({
    children,
    navbarContent,
  }: {
    children: ReactNode;
    navbarContent: { bookNow: { href: string; label: string } };
  }) => {
    pageLayoutPropsSpy({ navbarContent });
    return <div data-testid='page-layout'>{children}</div>;
  },
}));
vi.mock('@/components/sections/hero-banner', () => ({
  HeroBanner: ({
    content,
    ctaHref,
  }: {
    content: { headline: string };
    ctaHref?: string;
  }) => {
    heroBannerPropsSpy({ content, ctaHref });
    return <section data-testid='hero-banner'>{content.headline}</section>;
  },
}));
vi.mock('@/components/sections/real-talk', () => ({
  RealTalk: ({ content }: { content: { title: string } }) => (
    <section data-testid='real-talk'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/ida-intro', () => ({
  IdaIntro: ({ content }: { content: { heading: string; body: string } }) => (
    <section data-testid='ida-intro'>
      <h2>{content.heading}</h2>
      <p>{content.body}</p>
    </section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie-overview', () => ({
  MyBestAuntieOverview: ({ content }: { content: { title: string } }) => (
    <section data-testid='my-best-auntie-overview'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/deferred-testimonials', () => ({
  DeferredTestimonials: ({ content }: { content: { title: string } }) => (
    <section data-testid='deferred-testimonials'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/free-intro-session', () => ({
  FreeIntroSession: ({
    content,
    ctaHref,
  }: {
    content: { heading: string };
    ctaHref: string;
  }) => {
    freeIntroSessionPropsSpy({ content, ctaHref });
    return <section data-testid='free-intro-session'>{content.heading}</section>;
  },
}));

describe('HomePageSections', () => {
  it('composes homepage sections with the expected content slices', () => {
    process.env[WHATSAPP_URL_ENV_KEY] = 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr';
    delete process.env[BUSINESS_PHONE_ENV_KEY];
    heroBannerPropsSpy.mockClear();
    pageLayoutPropsSpy.mockClear();
    freeIntroSessionPropsSpy.mockClear();
    render(<HomePageSections locale='en' content={enContent} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('hero-banner')).toBeInTheDocument();
    expect(screen.getByTestId('real-talk')).toBeInTheDocument();
    expect(screen.getByTestId('ida-intro')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-overview')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('free-intro-session')).toBeInTheDocument();
    expect(screen.getByText(enContent.hero.headline)).toBeInTheDocument();
    expect(screen.getByText(enContent.idaIntro.heading)).toBeInTheDocument();
    expect(screen.getByText(enContent.idaIntro.body)).toBeInTheDocument();
    expect(
      screen.getByTestId('my-best-auntie-overview'),
    ).toHaveTextContent('My Best Auntie Training Course Designed by Ida');
    expect(heroBannerPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaHref: '/en/services/my-best-auntie-training-course',
      }),
    );
    expect(heroBannerPropsSpy).toHaveBeenCalledTimes(1);
    expect(pageLayoutPropsSpy).toHaveBeenCalledTimes(1);
    expect(freeIntroSessionPropsSpy).toHaveBeenCalledTimes(1);

    const heroProps = heroBannerPropsSpy.mock.calls[0][0];
    const pageLayoutProps = pageLayoutPropsSpy.mock.calls[0][0];
    const freeIntroProps = freeIntroSessionPropsSpy.mock.calls[0][0];
    expect(pageLayoutProps.navbarContent.bookNow.href).toBe(
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    expect(pageLayoutProps.navbarContent.bookNow.href).not.toBe(heroProps.ctaHref);
    expect(pageLayoutProps.navbarContent.bookNow.label).toBe(
      enContent.navbar.bookNow.label,
    );
    expect(freeIntroProps.ctaHref).toBe(pageLayoutProps.navbarContent.bookNow.href);

    const heroElement = screen.getByTestId('hero-banner');
    const realTalkElement = screen.getByTestId('real-talk');
    const idaIntroElement = screen.getByTestId('ida-intro');
    expect(heroElement.compareDocumentPosition(realTalkElement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(realTalkElement.compareDocumentPosition(idaIntroElement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('uses locale navbar prefill message when business phone is configured', () => {
    process.env[WHATSAPP_URL_ENV_KEY] = 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr';
    process.env[BUSINESS_PHONE_ENV_KEY] = '+852 9447 9843';
    heroBannerPropsSpy.mockClear();
    pageLayoutPropsSpy.mockClear();
    freeIntroSessionPropsSpy.mockClear();

    render(<HomePageSections locale='zh-HK' content={zhHKContent} />);

    expect(pageLayoutPropsSpy).toHaveBeenCalledTimes(1);
    expect(freeIntroSessionPropsSpy).toHaveBeenCalledTimes(1);
    const pageLayoutProps = pageLayoutPropsSpy.mock.calls[0][0];
    const freeIntroProps = freeIntroSessionPropsSpy.mock.calls[0][0];
    const parsedNavbarHref = new URL(pageLayoutProps.navbarContent.bookNow.href);

    expect(parsedNavbarHref.pathname).toBe('/85294479843');
    expect(parsedNavbarHref.searchParams.get('text')).toBe(
      zhHKContent.navbar.bookNow.prefillMessage,
    );
    expect(pageLayoutProps.navbarContent.bookNow.label).toBe(
      zhHKContent.navbar.bookNow.label,
    );
    expect(freeIntroProps.ctaHref).toBe(pageLayoutProps.navbarContent.bookNow.href);
  });
});
