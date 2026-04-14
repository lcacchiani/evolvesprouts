import type { ReservationPaymentMethodCode } from '@/lib/reservations-data';

export interface ReservationCourseSession {
  dateStartTime: string;
  dateEndTime?: string;
}

export interface ReservationSummary {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  ageGroup?: string;
  cohort?: string;
  /** Localized label from the payment form (analytics / legacy). */
  paymentMethod: string;
  /** Machine code; matches confirmation email payment row. */
  paymentMethodCode: ReservationPaymentMethodCode;
  totalAmount: number;
  eventTitle: string;
  dateStartTime?: string;
  dateEndTime?: string;
  /** All scheduled parts (MBA cohort dates or event date parts). */
  courseSessions?: ReservationCourseSession[];
  /** Subtitle shown under the title in the booking modal (course / event). */
  eventSubtitle?: string;
  locationName?: string;
  locationAddress?: string;
  /** Maps or venue URL for “Get directions” on the thank-you step. */
  locationDirectionHref?: string;
  /** Same as reservation payload: cohort / event date label for confirmation table Details row. */
  scheduleDateLabel?: string;
  /** Same as reservation payload: ISO range or time line for confirmation email. */
  scheduleTimeLabel?: string;
  /** First session start ISO (payload `primary_session_start_iso`). */
  primarySessionStartIso?: string;
  /** Payload `course_slug` for consultation vs MBA Details formatting. */
  courseSlug?: string;
  reservationPendingUntilPaymentConfirmed: boolean;
  /** FPS PNG data URL when client attached it to the reservation payload. */
  fpsQrImageDataUrl?: string;
  consultationWritingFocusLabel?: string;
  consultationLevelLabel?: string;
}

export interface BookingTopicsFieldConfig {
  label?: string;
  placeholder?: string;
  required?: boolean;
}
