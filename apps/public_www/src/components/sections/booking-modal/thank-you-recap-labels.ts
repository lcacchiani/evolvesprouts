import type {
  BookingThankYouRecapLabelTemplates,
} from '@/components/sections/booking-modal/types';
import type { BookingThankYouModalContent } from '@/content';

export function buildThankYouRecapLabels(
  thankYouModal: BookingThankYouModalContent,
): BookingThankYouRecapLabelTemplates {
  return {
    detailCohortLineTemplate: thankYouModal.detailCohortLineTemplate,
    detailAgeGroupLineTemplate: thankYouModal.detailAgeGroupLineTemplate,
    detailWritingFocusLineTemplate: thankYouModal.detailWritingFocusLineTemplate,
    detailLevelLineTemplate: thankYouModal.detailLevelLineTemplate,
  };
}
