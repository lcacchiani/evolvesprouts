import type { ReservationPaymentMethodCode } from '@/lib/reservations-data';

export interface ReservationCourseSession {
  dateStartTime: string;
  dateEndTime?: string;
}

export interface ReservationSummary {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  /** ISO 3166-1 alpha-2 region for the national phone number (e.g. HK). */
  attendeeCountry?: string;
  ageGroup?: string;
  cohort?: string;
  paymentMethod: string;
  totalAmount: number;
  eventTitle: string;
  dateStartTime?: string;
  dateEndTime?: string;
  /** All scheduled parts (MBA cohort dates or event date parts). */
  courseSessions?: ReservationCourseSession[];
  /** Subtitle shown under the title in the booking modal (course / event). */
  eventSubtitle?: string;
  /** Booking flow slug (e.g. my-best-auntie, consultation-booking, event-booking). */
  courseSlug?: string;
  locationName?: string;
  locationAddress?: string;
  /** Maps or venue URL for “Get directions” on the thank-you step. */
  locationDirectionHref?: string;
  /**
   * Raw payment method code from the form (fps_qr, bank_transfer, stripe, free).
   * When `free`, the booking total is zero: omit payment method label and the
   * thank-you recap payment row.
   */
  paymentMethodCode?: ReservationPaymentMethodCode;
  /** Inline FPS QR for thank-you recap when payment is FPS. */
  fpsQrImageDataUrl?: string;

  /** Structured detail lines for the thank-you recap (e.g. cohort, age group, consultation focus). */
  detailLines?: string[];
}

export interface BookingTopicsFieldConfig {
  label?: string;
  placeholder?: string;
  required?: boolean;
}

/** Locale templates for building `ReservationSummary.detailLines` in the reservation form. */
export interface BookingThankYouRecapLabelTemplates {
  detailCohortLineTemplate: string;
  detailAgeGroupLineTemplate: string;
  detailWritingFocusLineTemplate: string;
  detailLevelLineTemplate: string;
}
