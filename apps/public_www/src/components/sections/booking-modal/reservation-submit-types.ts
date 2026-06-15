import type { PaymentMethodOption } from '@/components/sections/booking-modal/reservation-form-types';
import type {
  BookingThankYouRecapLabelTemplates,
  BookingTopicsFieldConfig,
  ReservationCourseSession,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import type { BookingPaymentModalContent, Locale } from '@/content';
import type { DiscountRule } from '@/lib/discounts-data';
import type { ReservationPaymentMethodCode } from '@/lib/reservations-data';

export interface ReservationSubmitFormState {
  fullName: string;
  email: string;
  phone: string;
  phoneCountry: string;
  interestedTopics: string;
  hasPendingReservationAcknowledgement: boolean;
  hasTermsAgreement: boolean;
  marketingOptIn: boolean;
  captchaToken: string | null;
  fpsQrImageDataUrl: string;
}

export interface ReservationSubmitContext {
  analyticsSectionId: string;
  bookingSystem: string;
  cohortId: string;
  consultationLevelLabel: string;
  consultationWritingFocusLabel: string;
  content: BookingPaymentModalContent;
  dateEndTime: string;
  discountAmount: number;
  discountRule: DiscountRule | null;
  eventSubtitle: string;
  eventTitle: string;
  isFreeReservation: boolean;
  isStripePaymentIntentLoading: boolean;
  isStripePaymentMethodSelected: boolean;
  isStripeReady: boolean;
  isTopicsFieldRequired: boolean;
  locale: Locale;
  normalizedCohortDate: string;
  paymentMethodForAnalytics: ReservationPaymentMethodCode;
  requiresServiceInstanceSlug: boolean;
  selectedCohortDateLabel: string;
  selectedDateStartTime: string;
  selectedPaymentMethod: PaymentMethodOption;
  selectedServiceTierLabel: string;
  serviceInstanceSlug: string;
  serviceKey: string;
  serviceTypeLabelKey: 'event' | 'training-course' | 'consultation';
  sessionSlots?: ReservationCourseSession[];
  thankYouRecapLabels?: BookingThankYouRecapLabelTemplates;
  topicsFieldConfig?: BookingTopicsFieldConfig;
  totalAmount: number;
  venueAddress: string;
  venueDirectionHref: string;
  venueName: string;
}

export interface CreateReservationSubmitHandlerOptions {
  clearSubmissionError: () => void;
  isCaptchaUnavailable: boolean;
  isSubmitting: boolean;
  markCaptchaTouched: () => void;
  markFormInteracted: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
  onReservationMetaPixelSuccess: (totalAmount: number) => void;
  setIsAcknowledgementsTouched: (value: boolean) => void;
  setIsEmailTouched: (value: boolean) => void;
  setIsFullNameTouched: (value: boolean) => void;
  setIsPhoneTouched: (value: boolean) => void;
  setIsTopicsTouched: (value: boolean) => void;
  setSubmissionError: (message: string) => void;
  withSubmitting: <T>(fn: () => Promise<T>) => Promise<T>;
}
