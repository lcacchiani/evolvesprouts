import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePageSections } from '@/components/pages/homepage';
import { getContent } from '@/content';
import enContent from '@/content/en.json';

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
  [{ content: { title: string }; ctaHref?: string }],
  void
>();
const pageLayoutPropsSpy = vi.fn<
  [{ navbarContent: { bookNow: { href: string; label: string } } }],
  void
>();
const freeIntroSessionPropsSpy = vi.fn<
  [{ content: { title: string }; ctaHref: string }],
  void
>();
const myBestAuntieOutlinePropsSpy = vi.fn<
  [{ content: { title: string }; ctaHref?: string }],
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
    content: { title: string };
    ctaHref?: string;
  }) => {
    heroBannerPropsSpy({ content, ctaHref });
    return <section data-testid='hero-banner'>{content.title}</section>;
  },
}));
vi.mock('@/components/sections/real-talk', () => ({
  RealTalk: ({ content }: { content: { title: string } }) => (
    <section data-testid='real-talk'>{content.title}</section>
  ),
}));
vi.mock('@/components/sections/ida-intro', () => ({
  IdaIntro: ({ content }: { content: { title: string; description: string } }) => (
    <section data-testid='ida-intro'>
      <h2>{content.title}</h2>
      <p>{content.description}</p>
    </section>
  ),
}));
vi.mock('@/components/sections/my-best-auntie/my-best-auntie-outline', () => ({
  MyBestAuntieOutline: ({
    content,
    ctaHref,
  }: {
    content: { title: string };
    ctaHref?: string;
  }) => {
    myBestAuntieOutlinePropsSpy({ content, ctaHref });
    return <section data-testid='my-best-auntie-outline'>{content.title}</section>;
  },
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
    content: { title: string };
    ctaHref: string;
  }) => {
    freeIntroSessionPropsSpy({ content, ctaHref });
    return <section data-testid='free-intro-session'>{content.title}</section>;
  },
}));

describe('HomePageSections', () => {
  it('composes homepage sections with the expected content slices', () => {
    process.env[WHATSAPP_URL_ENV_KEY] = 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr';
    delete process.env[BUSINESS_PHONE_ENV_KEY];
    heroBannerPropsSpy.mockClear();
    pageLayoutPropsSpy.mockClear();
    freeIntroSessionPropsSpy.mockClear();
    myBestAuntieOutlinePropsSpy.mockClear();
    render(<HomePageSections locale='en' content={getContent('en')} />);

    expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    expect(screen.getByTestId('hero-banner')).toBeInTheDocument();
    expect(screen.getByTestId('real-talk')).toBeInTheDocument();
    expect(screen.getByTestId('ida-intro')).toBeInTheDocument();
    expect(screen.getByTestId('my-best-auntie-outline')).toBeInTheDocument();
    expect(screen.getByTestId('deferred-testimonials')).toBeInTheDocument();
    expect(screen.getByTestId('free-intro-session')).toBeInTheDocument();
    expect(screen.getByText(enContent.hero.title)).toBeInTheDocument();
    expect(screen.getByText(enContent.idaIntro.title)).toBeInTheDocument();
    expect(screen.getByText(enContent.idaIntro.description)).toBeInTheDocument();
    expect(
      screen.getByTestId('my-best-auntie-outline'),
    ).toHaveTextContent('My Best Auntie Training Course Designed by Ida');
    expect(heroBannerPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaHref: '/en/services/my-best-auntie-training-course',
      }),
    );
    expect(heroBannerPropsSpy).toHaveBeenCalledTimes(1);
    expect(pageLayoutPropsSpy).toHaveBeenCalledTimes(1);
    expect(freeIntroSessionPropsSpy).toHaveBeenCalledTimes(1);
    expect(myBestAuntieOutlinePropsSpy).toHaveBeenCalledTimes(1);

    const heroProps = heroBannerPropsSpy.mock.calls[0][0];
    const pageLayoutProps = pageLayoutPropsSpy.mock.calls[0][0];
    const freeIntroProps = freeIntroSessionPropsSpy.mock.calls[0][0];
    const outlineProps = myBestAuntieOutlinePropsSpy.mock.calls[0][0];
    expect(pageLayoutProps.navbarContent.bookNow.href).toBe(
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    expect(pageLayoutProps.navbarContent.bookNow.href).not.toBe(heroProps.ctaHref);
    expect(pageLayoutProps.navbarContent.bookNow.label).toBe(
      enContent.navbar.bookNow.label,
    );
    expect(freeIntroProps.ctaHref).toBe(pageLayoutProps.navbarContent.bookNow.href);
    expect(outlineProps.ctaHref).toBe(
      '/en/services/my-best-auntie-training-course#my-best-auntie-booking',
    );

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
    myBestAuntieOutlinePropsSpy.mockClear();

    const localizedContent = getContent('zh-HK');
    render(<HomePageSections locale='zh-HK' content={localizedContent} />);

    expect(pageLayoutPropsSpy).toHaveBeenCalledTimes(1);
    expect(freeIntroSessionPropsSpy).toHaveBeenCalledTimes(1);
    expect(myBestAuntieOutlinePropsSpy).toHaveBeenCalledTimes(1);
    const pageLayoutProps = pageLayoutPropsSpy.mock.calls[0][0];
    const freeIntroProps = freeIntroSessionPropsSpy.mock.calls[0][0];
    const parsedNavbarHref = new URL(pageLayoutProps.navbarContent.bookNow.href);

    expect(parsedNavbarHref.pathname).toBe('/85294479843');
    expect(parsedNavbarHref.searchParams.get('text')).toBe(
      localizedContent.navbar.bookNow.prefillMessage,
    );
    expect(pageLayoutProps.navbarContent.bookNow.label).toBe(
      localizedContent.navbar.bookNow.label,
    );
    expect(freeIntroProps.ctaHref).toBe(pageLayoutProps.navbarContent.bookNow.href);
    expect(myBestAuntieOutlinePropsSpy.mock.calls[0][0].ctaHref).toBe(
      '/zh-HK/services/my-best-auntie-training-course#my-best-auntie-booking',
    );
  });
});
