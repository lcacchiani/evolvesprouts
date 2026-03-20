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
}

export interface BookingTopicsFieldConfig {
  label?: string;
  placeholder?: string;
  required?: boolean;
}
