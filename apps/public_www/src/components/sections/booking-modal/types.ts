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
  paymentMethod: string;
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
