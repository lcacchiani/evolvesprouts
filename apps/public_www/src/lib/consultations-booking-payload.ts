import type { EventBookingModalPayload } from '@/lib/events-data';
import { CONSULTATION_BOOKING_SYSTEM } from '@/lib/events-data';
import type { ConsultationBookingReservationContent, Locale } from '@/content';
import { formatCurrencyHkd } from '@/lib/format';

export type ConsultationBookingTierId = 'essentials' | 'deepDive';

export function buildConsultationEventBookingPayload(
  tierId: ConsultationBookingTierId,
  reservation: ConsultationBookingReservationContent,
  locale: Locale,
): EventBookingModalPayload {
  const tier = tierId === 'essentials' ? reservation.essentials : reservation.deepDive;
  const firstPart = tier.dateParts[0];
  const selectedDateStartTime = firstPart?.startDateTime?.trim() ?? '';

  return {
    variant: 'event',
    bookingSystem: CONSULTATION_BOOKING_SYSTEM,
    title: reservation.modalTitle,
    subtitle: reservation.modalSubtitle,
    originalAmount: tier.priceHkd,
    locationName: reservation.locationName,
    locationAddress: reservation.locationAddress,
    directionHref: reservation.directionHref,
    dateParts: tier.dateParts.map((part) => ({
      id: part.id,
      startDateTime: part.startDateTime,
      endDateTime: part.endDateTime,
      description: part.descriptionTemplate.replace(
        '{price}',
        formatCurrencyHkd(tier.priceHkd, locale),
      ),
    })),
    selectedDateLabel: reservation.selectedDateLabel,
    selectedDateStartTime,
    topicsFieldConfig: {
      label: reservation.topicsField.label,
      placeholder: reservation.topicsField.placeholder,
      required: reservation.topicsField.required,
    },
  };
}
