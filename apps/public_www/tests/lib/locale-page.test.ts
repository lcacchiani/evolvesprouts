import { beforeEach, describe, expect, it, vi } from 'vitest';

const { notFoundMock, redirectMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(),
  redirectMock: vi.fn((value: string) => {
    throw new Error(`redirect:${value}`);
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

import {
  createDefaultLocaleRedirectPage,
  createLocaleAliasRedirectPage,
  createPlaceholderPage,
  getFooterLinkLabel,
} from '@/lib/locale-page';

describe('locale-page', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    notFoundMock.mockClear();
  });

  it('creates a default-locale redirect page', () => {
    const RedirectPage = createDefaultLocaleRedirectPage('/about-us');

    expect(() => {
      RedirectPage();
    }).toThrow('redirect:/en/about-us');
    expect(redirectMock).toHaveBeenCalledWith('/en/about-us');
  });

  it('creates a locale-aware alias redirect page for path aliases', async () => {
    const AliasPage = createLocaleAliasRedirectPage('/contact-us');

    await expect(
      AliasPage({ params: Promise.resolve({ locale: 'zh-CN' }) }),
    ).rejects.toThrow('redirect:/zh-CN/contact-us');
    expect(redirectMock).toHaveBeenCalledWith('/zh-CN/contact-us');
  });

  it('creates a locale-aware alias redirect page with custom resolver', async () => {
    const AliasPage = createLocaleAliasRedirectPage(
      (locale) => `/${locale}#resources`,
    );

    await expect(
      AliasPage({ params: Promise.resolve({ locale: 'zh-HK' }) }),
    ).rejects.toThrow('redirect:/zh-HK#resources');
    expect(redirectMock).toHaveBeenCalledWith('/zh-HK#resources');
  });

  it('builds placeholder metadata and title resolution helpers', async () => {
    const placeholderPage = createPlaceholderPage({
      path: '/privacy',
      fallbackTitle: 'Privacy Policy',
      labelResolver: getFooterLinkLabel,
    });

    const metadata = await placeholderPage.generateMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });
    const resolved = await placeholderPage.resolveProps(
      Promise.resolve({ locale: 'en' }),
    );

    expect(metadata.title).toContain('Privacy');
    expect(metadata.alternates?.canonical).toBe('/en/privacy');
    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
    expect(resolved.title).toBeTruthy();
    expect(resolved.content.meta.locale).toBe('en');
  });
});
