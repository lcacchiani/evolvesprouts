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
  locationName?: string;
  locationAddress?: string;
}

export interface BookingTopicsFieldConfig {
  label?: string;
  placeholder?: string;
  required?: boolean;
}
