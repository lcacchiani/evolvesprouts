import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackAnalyticsEvent, trackPublicFormOutcome } from '@/lib/analytics';

const originalSiteOrigin = process.env.NEXT_PUBLIC_SITE_ORIGIN;

describe('analytics helper', () => {
  afterEach(() => {
    window.dataLayer = [];
    if (originalSiteOrigin === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_SITE_ORIGIN = originalSiteOrigin;
    }
  });

  it('pushes event payload with common params and custom params', () => {
    process.env.NEXT_PUBLIC_SITE_ORIGIN = 'https://www.evolvesprouts.com';
    window.dataLayer = [];
    document.title = 'Analytics Test';
    window.history.replaceState({}, '', '/en/contact-us?from=test');
    document.documentElement.lang = 'en';

    trackPublicFormOutcome('contact_form_submit_success', {
      formKind: 'contact',
      formId: 'contact-us-form',
      sectionId: 'contact-us-form',
      ctaLocation: 'form',
      params: {
        form_type: 'contact_us',
      },
    });

    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer?.[0]).toEqual({
      event: 'contact_form_submit_success',
      page_path: '/en/contact-us',
      page_title: 'Analytics Test',
      page_locale: 'en',
      section_id: 'contact-us-form',
      cta_location: 'form',
      environment: 'staging',
      form_kind: 'contact',
      form_id: 'contact-us-form',
      form_type: 'contact_us',
    });
  });

  it('initializes dataLayer when it does not exist', () => {
    delete window.dataLayer;

    trackAnalyticsEvent('whatsapp_click', {
      sectionId: 'whatsapp-contact-button',
      ctaLocation: 'floating_button',
    });

    expect(Array.isArray(window.dataLayer)).toBe(true);
    expect(window.dataLayer).toHaveLength(1);
  });

  it('does not push to dataLayer when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    trackAnalyticsEvent('whatsapp_click', {
      sectionId: 'x',
      ctaLocation: 'y',
    });
    vi.unstubAllGlobals();
  });

  it('trackPublicFormOutcome keeps formKind over params.form_kind', () => {
    window.dataLayer = [];
    trackPublicFormOutcome('contact_form_submit_success', {
      formKind: 'contact',
      formId: 'contact-us-form',
      sectionId: 'contact-us-form',
      ctaLocation: 'form',
      params: {
        form_type: 'contact_us',
        form_kind: 'media_request',
      },
    });
    expect(window.dataLayer?.[0]).toMatchObject({
      form_kind: 'contact',
      form_type: 'contact_us',
    });
  });

  it('uses default section and cta values when omitted', () => {
    window.dataLayer = [];

    trackAnalyticsEvent('booking_modal_open');

    expect(window.dataLayer?.[0]).toEqual(
      expect.objectContaining({
        section_id: 'unknown',
        cta_location: 'n/a',
      }),
    );
  });
});
