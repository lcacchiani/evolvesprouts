export interface ReservationSummary {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  childAgeGroup: string;
  paymentMethod: string;
  totalAmount: number;
  courseLabel: string;
  scheduleDateLabel?: string;
  scheduleTimeLabel?: string;
}
