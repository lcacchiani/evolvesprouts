import { afterEach, describe, expect, it } from 'vitest';

import enContent from '@/content/en.json';
import type { EventCardData } from '@/lib/events-data';
import { ROUTES } from '@/lib/routes';
import {
  buildBreadcrumbSchema,
  buildCourseSchema,
  buildEventSchemas,
  buildFaqPageSchema,
  buildLocalBusinessSchema,
  buildOrganizationSchema,
} from '@/lib/structured-data';

const ENV_KEYS = [
  'NEXT_PUBLIC_INSTAGRAM_URL',
  'NEXT_PUBLIC_LINKEDIN_URL',
  'NEXT_PUBLIC_WHATSAPP_URL',
  'NEXT_PUBLIC_BUSINESS_ADDRESS',
  'NEXT_PUBLIC_BUSINESS_PHONE_NUMBER',
] as const;

const originalEnvValues = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const originalValue = originalEnvValues[key];
    if (typeof originalValue === 'string') {
      process.env[key] = originalValue;
    } else {
      delete process.env[key];
    }
  }
});

describe('structured-data builders', () => {
  it('builds organization and local business schemas with configured env values', () => {
    process.env.NEXT_PUBLIC_INSTAGRAM_URL = 'https://www.instagram.com/evolve_sprouts';
    process.env.NEXT_PUBLIC_LINKEDIN_URL = 'https://www.linkedin.com/company/evolve-sprouts';
    process.env.NEXT_PUBLIC_WHATSAPP_URL = 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr';
    process.env.NEXT_PUBLIC_BUSINESS_ADDRESS = 'Mid-Levels, Hong Kong';
    process.env.NEXT_PUBLIC_BUSINESS_PHONE_NUMBER = '+852 5555 5555';

    const organizationSchema = buildOrganizationSchema({
      locale: 'en',
      content: enContent,
    });
    const localBusinessSchema = buildLocalBusinessSchema({
      locale: 'en',
      content: enContent,
    });

    expect(organizationSchema).toMatchObject({
      '@type': 'Organization',
      name: enContent.navbar.brand,
      sameAs: [
        process.env.NEXT_PUBLIC_INSTAGRAM_URL,
        process.env.NEXT_PUBLIC_LINKEDIN_URL,
        process.env.NEXT_PUBLIC_WHATSAPP_URL,
      ],
    });
    expect(localBusinessSchema).toMatchObject({
      '@type': 'LocalBusiness',
      telephone: process.env.NEXT_PUBLIC_BUSINESS_PHONE_NUMBER,
      address: {
        '@type': 'PostalAddress',
        streetAddress: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS,
      },
      areaServed: enContent.seo.localBusinessAreaServed,
    });
  });

  it('builds localized FAQ, course, and breadcrumb schemas', () => {
    const faqSchema = buildFaqPageSchema(enContent.faq);
    const courseSchema = buildCourseSchema({
      locale: 'zh-CN',
      content: enContent,
    });
    const breadcrumbSchema = buildBreadcrumbSchema({
      locale: 'zh-HK',
      items: [
        { name: 'Home', path: ROUTES.home },
        { name: 'About Us', path: ROUTES.about },
      ],
    });

    expect(faqSchema).toMatchObject({
      '@type': 'FAQPage',
    });
    expect(courseSchema).toMatchObject({
      '@type': 'Course',
      name: enContent.seo.trainingCourse.title,
      description: enContent.seo.trainingCourse.description,
      url: expect.stringContaining('/zh-CN/services/my-best-auntie-training-course'),
    });
    expect(breadcrumbSchema).toMatchObject({
      '@type': 'BreadcrumbList',
    });
    const breadcrumbItems = Array.isArray(breadcrumbSchema.itemListElement)
      ? breadcrumbSchema.itemListElement
      : [];
    const firstBreadcrumbItem = breadcrumbItems[0] as {
      item?: string;
    } | undefined;
    const secondBreadcrumbItem = breadcrumbItems[1] as {
      item?: string;
    } | undefined;
    expect(firstBreadcrumbItem?.item).toContain('/zh-HK');
    expect(secondBreadcrumbItem?.item).toContain('/zh-HK/about-us');
  });

  it('builds event schemas only for events with timestamps', () => {
    const events: EventCardData[] = [
      {
        id: 'event-with-time',
        title: 'Montessori Workshop',
        summary: 'A practical workshop for parents.',
        dateLabel: '12 Apr 2026',
        timeLabel: '10:00 AM',
        locationName: 'In-person',
        locationAddress: 'Mid-Levels, Hong Kong',
        ctaHref: 'https://example.com/register',
        ctaLabel: 'Reserve your spot',
        tags: ['Workshop'],
        status: 'open',
        timestamp: Date.parse('2026-04-12T10:00:00.000Z'),
      },
      {
        id: 'event-without-time',
        title: 'Missing Date Event',
        summary: 'Should not render in JSON-LD.',
        dateLabel: '',
        timeLabel: '',
        locationName: '',
        locationAddress: '',
        ctaHref: '',
        ctaLabel: '',
        tags: [],
        status: 'open',
        timestamp: null,
      },
    ];

    const eventSchemas = buildEventSchemas({
      locale: 'en',
      events,
    });

    expect(eventSchemas).toHaveLength(1);
    expect(eventSchemas[0]).toMatchObject({
      '@type': 'Event',
      name: 'Montessori Workshop',
      startDate: '2026-04-12T10:00:00.000Z',
    });
  });
});
