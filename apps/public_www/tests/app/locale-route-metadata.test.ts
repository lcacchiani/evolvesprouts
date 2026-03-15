import { describe, expect, it } from 'vitest';

import { SUPPORTED_LOCALES } from '@/content';
import {
  generateMetadata as generateContactMetadata,
  generateStaticParams as generateContactStaticParams,
} from '@/app/[locale]/contact-us/page';
import {
  generateMetadata as generateEventsMetadata,
  generateStaticParams as generateEventsStaticParams,
} from '@/app/[locale]/events/page';
import {
  generateMetadata as generateHomeMetadata,
  generateStaticParams as generateHomeStaticParams,
} from '@/app/[locale]/page';

describe('localized route metadata and static params', () => {
  const expectedStaticParams = SUPPORTED_LOCALES.map((locale) => ({ locale }));

  it('generates static params for the home locale route', () => {
    expect(generateHomeStaticParams()).toEqual(expectedStaticParams);
  });

  it('generates static params for the contact locale route', () => {
    expect(generateContactStaticParams()).toEqual(expectedStaticParams);
  });

  it('generates static params for the events locale route', () => {
    expect(generateEventsStaticParams()).toEqual(expectedStaticParams);
  });

  it('builds localized metadata for home/contact/events pages', async () => {
    const homeMetadata = await generateHomeMetadata({
      params: Promise.resolve({ locale: 'zh-CN' }),
    });
    const contactMetadata = await generateContactMetadata({
      params: Promise.resolve({ locale: 'zh-HK' }),
    });
    const eventsMetadata = await generateEventsMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(homeMetadata.alternates?.canonical).toBe('/zh-CN/');
    expect(contactMetadata.alternates?.canonical).toBe('/zh-HK/contact-us/');
    expect(eventsMetadata.alternates?.canonical).toBe('/en/events/');
    expect(homeMetadata.openGraph?.locale).toBe('zh-CN');
    expect(contactMetadata.openGraph?.locale).toBe('zh-HK');
    expect(eventsMetadata.openGraph?.locale).toBe('en');
  });
});
