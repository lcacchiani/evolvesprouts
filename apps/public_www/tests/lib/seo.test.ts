import { describe, expect, it } from 'vitest';

import {
  buildLocalizedMetadata,
  DEFAULT_SOCIAL_IMAGE,
  normalizeSiteOrigin,
} from '@/lib/seo';

describe('seo metadata builder', () => {
  it('builds localized alternates and social metadata', () => {
    const metadata = buildLocalizedMetadata({
      locale: 'zh-CN',
      path: '/about-us',
      title: 'About Us',
      description: 'About page description',
    });

    expect(metadata.alternates?.canonical).toBe('/zh-CN/about-us');
    expect(metadata.alternates?.languages).toMatchObject({
      en: '/en/about-us',
      'zh-CN': '/zh-CN/about-us',
      'zh-HK': '/zh-HK/about-us',
      'x-default': '/en/about-us',
    });
    expect(metadata.openGraph).toMatchObject({
      title: 'About Us - Evolve Sprouts',
      description: 'About page description',
      url: '/zh-CN/about-us',
      type: 'website',
      locale: 'zh-CN',
      siteName: 'Evolve Sprouts',
    });
    expect(metadata.openGraph?.images?.[0]).toMatchObject({
      url: DEFAULT_SOCIAL_IMAGE,
      alt: 'Evolve Sprouts',
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'About Us - Evolve Sprouts',
      description: 'About page description',
      images: [DEFAULT_SOCIAL_IMAGE],
    });
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
    });
  });

  it('keeps root page title without the site suffix', () => {
    const metadata = buildLocalizedMetadata({
      locale: 'en',
      path: '/',
      title: 'Evolve Sprouts',
      description: 'Home page',
    });

    expect(metadata.title).toBe('Evolve Sprouts');
  });

  it('applies explicit robots override values when provided', () => {
    const metadata = buildLocalizedMetadata({
      locale: 'en',
      path: '/privacy',
      title: 'Privacy Policy',
      description: 'Placeholder page',
      robots: {
        index: false,
        follow: true,
      },
    });

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: true,
    });
  });

  it('uses page-level social image overrides when provided', () => {
    const metadata = buildLocalizedMetadata({
      locale: 'en',
      path: '/events',
      title: 'Events',
      description: 'Upcoming events',
      socialImage: {
        url: '/images/seo/custom-og.png',
        alt: 'Custom OG image',
      },
    });

    expect(metadata.openGraph?.images?.[0]).toMatchObject({
      url: '/images/seo/custom-og.png',
      alt: 'Custom OG image',
    });
    expect(metadata.twitter).toMatchObject({
      images: ['/images/seo/custom-og.png'],
    });
  });

  it('normalizes valid HTTPS origins for site metadata', () => {
    expect(normalizeSiteOrigin('https://example.com/')).toBe('https://example.com');
  });

  it('allows localhost HTTP origin for local development', () => {
    expect(normalizeSiteOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('rejects non-HTTPS non-localhost origins', () => {
    expect(() => normalizeSiteOrigin('http://example.com')).toThrow(
      'must use https, or http://localhost',
    );
  });

  it('rejects origins that include path/query/hash', () => {
    expect(() => normalizeSiteOrigin('https://example.com/path')).toThrow(
      'must not include a path, query string, or hash fragment',
    );
  });
});
