/**
 * Catalog of Meta Pixel `content_name` values used with `trackMetaPixelEvent`.
 * GA4 uses analytics-taxonomy.json + validators; this file is the Meta Pixel equivalent.
 */

export const META_PIXEL_CONTENT_NAMES = {
  contact_form: {
    label: 'Contact form submission',
    allowedEvents: ['Lead'] as const,
  },
  media_download: {
    label: 'Media download lead',
    allowedEvents: ['Lead'] as const,
  },
  community_signup: {
    label: 'Community / squad signup',
    allowedEvents: ['Lead'] as const,
  },
  event_notification: {
    label: 'Event notification signup',
    allowedEvents: ['Lead'] as const,
  },
  whatsapp: {
    label: 'WhatsApp',
    allowedEvents: ['Contact', 'ViewContent'] as const,
  },
  my_best_auntie: {
    label: 'My Best Auntie booking',
    allowedEvents: ['InitiateCheckout', 'Schedule'] as const,
  },
  event_booking: {
    label: 'Event booking',
    allowedEvents: ['InitiateCheckout', 'Schedule'] as const,
  },
  consultation_booking: {
    label: 'Consultation booking',
    allowedEvents: ['InitiateCheckout', 'Schedule'] as const,
  },
  my_best_auntie_course: {
    label: 'Links hub — course',
    allowedEvents: ['ViewContent'] as const,
  },
  contact_us: {
    label: 'Links hub — contact',
    allowedEvents: ['ViewContent'] as const,
  },
  events: {
    label: 'Links hub — events',
    allowedEvents: ['ViewContent'] as const,
  },
  instagram: {
    label: 'Links hub — Instagram',
    allowedEvents: ['ViewContent'] as const,
  },
} as const;

export type MetaPixelStaticContentName = keyof typeof META_PIXEL_CONTENT_NAMES;

/** Typed `content_name` literals for call sites (validator + TypeScript). */
export const PIXEL_CONTENT_NAME = {
  contact_form: 'contact_form',
  media_download: 'media_download',
  community_signup: 'community_signup',
  event_notification: 'event_notification',
  whatsapp: 'whatsapp',
  my_best_auntie: 'my_best_auntie',
  event_booking: 'event_booking',
  consultation_booking: 'consultation_booking',
  my_best_auntie_course: 'my_best_auntie_course',
  contact_us: 'contact_us',
  events: 'events',
  instagram: 'instagram',
} as const satisfies { [K in MetaPixelStaticContentName]: K };
