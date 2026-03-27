/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ComponentProps, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  originalFpsMerchantName,
  originalFpsMobileNumber,
  originalBankName,
  originalBankAccountHolder,
  originalBankAccountNumber,
  originalStripePublishableKey,
} = vi.hoisted(() => {
  const originalFpsMerchantName = process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME;
  const originalFpsMobileNumber = process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER;
  const originalBankName = process.env.NEXT_PUBLIC_BANK_NAME;
  const originalBankAccountHolder = process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER;
  const originalBankAccountNumber = process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER;
  const originalStripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME = 'Test FPS Merchant';
  process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER = '85200000000';
  process.env.NEXT_PUBLIC_BANK_NAME = 'Test Bank';
  process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER = 'Test Account Holder';
  process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER = '123-456-789';
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_123';

  return {
    originalFpsMerchantName,
    originalFpsMobileNumber,
    originalBankName,
    originalBankAccountHolder,
    originalBankAccountNumber,
    originalStripePublishableKey,
  };
});
const mockedStripeElementsProps = vi.hoisted(() => vi.fn());
const mockedStripePaymentElementProps = vi.hoisted(() => vi.fn());

import {
  MyBestAuntieBookingModal,
  MyBestAuntieThankYouModal,
} from '@/components/sections/my-best-auntie/my-best-auntie-booking-modal';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import enContent from '@/content/en.json';
import trainingCoursesContent from '@/content/my-best-auntie-training-courses.json';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { createPublicApiClient, createPublicCrmApiClient } from '@/lib/crm-api-client';
import { validateDiscountCode } from '@/lib/discounts-data';
import { createReservationPaymentIntent } from '@/lib/reservation-payments-data';
import {
  formatSiteCompactDate,
  formatSiteTimeOfDay,
} from '@/lib/site-datetime';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve({})),
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({
    children,
    ...props
  }: {
    children: ReactNode;
    options?: unknown;
    stripe?: unknown;
  }) => {
    mockedStripeElementsProps(props);
    return <div>{children}</div>;
  },
  PaymentElement: (props: { options?: unknown }) => {
    mockedStripePaymentElementProps(props);
    return <div data-testid='mock-stripe-payment-element' />;
  },
  useElements: () => ({}),
  useStripe: () => ({
    confirmPayment: vi.fn(async () => ({
      paymentIntent: {
        id: 'pi_test_booking_modal',
        status: 'succeeded',
      },
    })),
  }),
}));

vi.mock('@/lib/crm-api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm-api-client')>(
    '@/lib/crm-api-client',
  );

  return {
    ...actual,
    createPublicApiClient: vi.fn(() => null),
    createPublicCrmApiClient: vi.fn(() => null),
    isAbortRequestError: (error: unknown) =>
      error instanceof Error && error.name === 'AbortError',
  };
});

vi.mock('@/lib/discounts-data', async () => {
  const actual = await vi.importActual<typeof import('@/lib/discounts-data')>(
    '@/lib/discounts-data',
  );

  return {
    ...actual,
    validateDiscountCode: vi.fn(() => Promise.resolve(null)),
  };
});

vi.mock('@/lib/reservation-payments-data', () => ({
  createReservationPaymentIntent: vi.fn(() =>
    Promise.resolve({
      payment_intent_id: 'pi_mock_123',
      client_secret: 'pi_mock_123_secret_abc',
    })),
}));

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
  trackEcommerceEvent: vi.fn(),
}));

vi.mock('@/components/shared/turnstile-captcha', () => ({
  TurnstileCaptcha: ({
    onTokenChange,
    onLoadError,
  }: {
    onTokenChange: (token: string | null) => void;
    onLoadError: () => void;
  }) => (
    <div data-testid='mock-turnstile-captcha'>
      <button
        data-testid='mock-turnstile-captcha-solve'
        type='button'
        onClick={() => {
          onTokenChange('mock-turnstile-token');
        }}
      >
        Solve CAPTCHA
      </button>
      <button
        data-testid='mock-turnstile-captcha-fail'
        type='button'
        onClick={() => {
          onLoadError();
        }}
      >
        Fail CAPTCHA
      </button>
    </div>
  ),
}));

const bookingSectionContent = {
  ...enContent.myBestAuntie.booking,
  cohorts: trainingCoursesContent.data,
};
const myBestAuntieModalContent = enContent.myBestAuntie.modal;
const bookingModalContent = enContent.bookingModal.paymentModal;
const bookingModalStripeEnabledContent = {
  ...bookingModalContent,
  paymentOptionsStripeCardsEnabled: true,
};
const thankYouModalContent = enContent.bookingModal.thankYouModal;
const selectedCohort = bookingSectionContent.cohorts[0];
if (!selectedCohort) {
  throw new Error('Test content must include at least one cohort.');
}
const mockedCreateCrmApiClient = vi.mocked(createPublicCrmApiClient);
const mockedCreatePublicApiClient = vi.mocked(createPublicApiClient);
const mockedValidateDiscountCode = vi.mocked(validateDiscountCode);
const mockedCreateReservationPaymentIntent = vi.mocked(createReservationPaymentIntent);
const mockedTrackAnalyticsEvent = vi.mocked(trackAnalyticsEvent);
const testTurnstileSiteKey = 'test-turnstile-site-key';
const testFpsMerchantName = 'Test FPS Merchant';
const testFpsMobileNumber = '85200000000';
const testBankName = 'Test Bank';
const testBankAccountHolder = 'Test Account Holder';
const testBankAccountNumber = '123-456-789';
const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const reservationSummary: ReservationSummary = {
  attendeeName: 'Test User',
  attendeeEmail: 'test@example.com',
  attendeePhone: '12345678',
  ageGroup: '1-3',
  paymentMethod: 'Pay via FPS QR',
  totalAmount: 9000,
  eventTitle: 'My Best Auntie',
  dateStartTime: selectedCohort.dates[0]?.start_datetime,
  dateEndTime: selectedCohort.dates[0]?.end_datetime,
  courseSessions: selectedCohort.dates.slice(0, 2).map((part) => {
    return {
      dateStartTime: part.start_datetime,
      dateEndTime: part.end_datetime,
    };
  }),
  eventSubtitle: myBestAuntieModalContent.subtitle,
  locationName: selectedCohort.location_name,
  locationAddress: selectedCohort.location_address,
  locationDirectionHref: selectedCohort.location_url,
};

const selectedCohortDate = selectedCohort.dates[0]?.start_datetime.slice(0, 10);
if (!selectedCohortDate) {
  throw new Error('Selected cohort must include a valid primary session date.');
}

function renderWithPortalContainer(ui: ReactNode) {
  const renderView = render(ui);
  return {
    ...renderView,
    container: document.body,
  };
}

function renderBookingModal(
  props: Partial<ComponentProps<typeof MyBestAuntieBookingModal>> = {},
) {
  return renderWithPortalContainer(
    <MyBestAuntieBookingModal
      modalContent={myBestAuntieModalContent}
      paymentModalContent={bookingModalContent}
      selectedCohort={selectedCohort}
      onClose={() => {}}
      onSubmitReservation={() => {}}
      {...props}
    />,
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = testTurnstileSiteKey;
  process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME = testFpsMerchantName;
  process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER = testFpsMobileNumber;
  process.env.NEXT_PUBLIC_BANK_NAME = testBankName;
  process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER = testBankAccountHolder;
  process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER = testBankAccountNumber;
});

afterEach(() => {
  mockedCreateCrmApiClient.mockReturnValue(null);
  mockedCreatePublicApiClient.mockReturnValue(null);
  mockedValidateDiscountCode.mockReset();
  mockedCreateReservationPaymentIntent.mockReset();
  mockedTrackAnalyticsEvent.mockReset();
  mockedStripeElementsProps.mockReset();
  mockedStripePaymentElementProps.mockReset();

  if (originalTurnstileSiteKey === undefined) {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  } else {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
  }

  if (originalFpsMerchantName === undefined) {
    delete process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME;
  } else {
    process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME = originalFpsMerchantName;
  }

  if (originalFpsMobileNumber === undefined) {
    delete process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER;
  } else {
    process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER = originalFpsMobileNumber;
  }

  if (originalBankName === undefined) {
    delete process.env.NEXT_PUBLIC_BANK_NAME;
  } else {
    process.env.NEXT_PUBLIC_BANK_NAME = originalBankName;
  }

  if (originalBankAccountHolder === undefined) {
    delete process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER;
  } else {
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_HOLDER = originalBankAccountHolder;
  }

  if (originalBankAccountNumber === undefined) {
    delete process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER;
  } else {
    process.env.NEXT_PUBLIC_BANK_ACCOUNT_NUMBER = originalBankAccountNumber;
  }

  if (originalStripePublishableKey === undefined) {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalStripePublishableKey;
  }
});

describe('my-best-auntie booking modals footer content', () => {
  it('exposes labelled dialog semantics for booking and thank-you modals', () => {
    const bookingModalView = renderBookingModal();

    const bookingDialog = screen.getByRole('dialog', {
      name: myBestAuntieModalContent.title,
    });
    const bookingDescriptionId = bookingDialog.getAttribute('aria-describedby');
    expect(bookingDialog).toHaveAttribute('aria-labelledby');
    expect(bookingDescriptionId).toBeTruthy();
    expect(document.getElementById(bookingDescriptionId ?? '')).not.toBeNull();
    expect(screen.getByText(myBestAuntieModalContent.subtitle)).toBeInTheDocument();
    expect(screen.queryByText('Thanks for your interest!')).not.toBeInTheDocument();

    bookingModalView.unmount();

    render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        onClose={() => {}}
      />,
    );

    const thankYouDialog = screen.getByRole('dialog', {
      name: thankYouModalContent.title,
    });
    const thankYouDescriptionId = thankYouDialog.getAttribute('aria-describedby');
    expect(thankYouDialog).toHaveAttribute('aria-labelledby');
    expect(thankYouDescriptionId).toBeTruthy();
    expect(
      document.getElementById(thankYouDescriptionId ?? '')?.textContent ?? '',
    ).toContain(thankYouModalContent.successLabel);
  });

  it('hides child age group and renders icon-based payment option radios in booking modal', () => {
    const { container } = renderBookingModal({
      selectedAgeGroupLabel: '18-24 months',
    });

    expect(
      screen.queryByText(bookingModalContent.selectedAgeGroupLabel),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('18-24 months')).not.toBeInTheDocument();
    expect(
      screen.getByText(bookingModalContent.paymentMethodLabel),
    ).toBeInTheDocument();
    const fpsPaymentOption = screen.getByRole('radio', {
      name: bookingModalContent.paymentMethodValue,
    });
    expect(fpsPaymentOption).toBeInTheDocument();
    expect(fpsPaymentOption).toBeChecked();
    const bankTransferOption = screen.getByRole('radio', {
      name: bookingModalContent.paymentMethodBankTransferValue,
    });
    expect(bankTransferOption).toBeInTheDocument();
    expect(bankTransferOption).not.toBeChecked();

    const paymentBlock = container.querySelector(
      'div[data-booking-payment="true"]',
    ) as HTMLDivElement | null;
    expect(paymentBlock).not.toBeNull();
    expect(
      within(paymentBlock as HTMLDivElement).getByText(bookingModalContent.paymentMethodLabel),
    )
      .toBeInTheDocument();
    expect(
      paymentBlock?.querySelector('img[data-booking-stripe-icon="true"]'),
    ).not.toBeNull();
  });

  it('does not render course schedule heading and uses shared calendar icon in booking modal', () => {
    const { container } = renderBookingModal();

    expect(screen.queryByText('Course Schedule')).not.toBeInTheDocument();
    const partCalendarIcons = container.querySelectorAll(
      'span[data-course-part-icon="true"].es-mask-calendar-current',
    );
    expect(partCalendarIcons).toHaveLength(3);
  });

  it('renders week range headlines and schedule blocks without year in the details column', () => {
    const { container } = renderBookingModal();
    expect(screen.getByText('19 Apr - 09 May')).toBeInTheDocument();
    expect(screen.getByText('10 May - 30 May')).toBeInTheDocument();
    expect(screen.getByText('31 May - 20 Jun')).toBeInTheDocument();
    const firstScheduleBlock = container.querySelector(
      'p[data-course-part-schedule-block="true"]',
    );
    expect(firstScheduleBlock?.textContent).toBe(
      'Group session: 19 Apr @ 09:00\nHome visit: scheduled individually\nParent call: scheduled individually',
    );
  });

  it('validates reservation email only after blur', () => {
    renderBookingModal();

    const emailField = screen.getByLabelText(
      new RegExp(bookingModalContent.emailLabel),
    );
    fireEvent.change(emailField, { target: { value: 'invalid-email' } });
    expect(
      screen.queryByText(bookingModalContent.emailValidationError),
    ).not.toBeInTheDocument();

    fireEvent.blur(emailField);
    expect(screen.getByText(bookingModalContent.emailValidationError)).toBeInTheDocument();
    expect(emailField).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not render legacy month/package selector controls in booking modal', () => {
    const { container } = renderBookingModal();
    expect(container.querySelectorAll('button[aria-pressed="true"]')).toHaveLength(0);
    expect(container.querySelectorAll('button[aria-pressed="false"]')).toHaveLength(0);
  });

  it('renders topics textarea and required acknowledgement checkboxes', () => {
    const { container } = renderBookingModal();

    const topicsField = screen.getByLabelText(bookingModalContent.topicsInterestLabel);
    expect(topicsField.tagName).toBe('TEXTAREA');
    expect(topicsField).toHaveAttribute(
      'placeholder',
      bookingModalContent.topicsInterestPlaceholder,
    );

    const fullNameField = screen.getByLabelText(
      new RegExp(bookingModalContent.fullNameLabel),
    );
    const emailField = screen.getByLabelText(new RegExp(bookingModalContent.emailLabel));
    const phoneField = screen.getByLabelText(new RegExp(bookingModalContent.phoneLabel));

    const pendingAcknowledgement = screen.getByRole('checkbox', {
      name: new RegExp(bookingModalContent.pendingReservationAcknowledgementLabel),
    });
    const termsAcknowledgement = screen.getByRole('checkbox', {
      name: new RegExp(bookingModalContent.termsLinkLabel),
    });

    expect(pendingAcknowledgement).toBeRequired();
    expect(termsAcknowledgement).toBeRequired();

    const termsLink = screen.getByRole('link', {
      name: bookingModalContent.termsLinkLabel,
    });
    expect(termsLink).toHaveAttribute('href', bookingModalContent.termsHref);

    const acknowledgementsBlock = pendingAcknowledgement.closest(
      'div[data-booking-acknowledgements="true"]',
    ) as HTMLDivElement | null;
    expect(acknowledgementsBlock).not.toBeNull();

    const pendingWrapperClassName =
      pendingAcknowledgement.closest('label')?.className ?? '';
    const termsWrapperClassName = termsAcknowledgement.closest('label')?.className ?? '';
    expect(pendingWrapperClassName).not.toContain('border');
    expect(pendingWrapperClassName).not.toContain('bg-');
    expect(termsWrapperClassName).not.toContain('border');
    expect(termsWrapperClassName).not.toContain('bg-');

    const paymentBlock = container.querySelector(
      'div[data-booking-payment="true"]',
    ) as HTMLDivElement | null;
    expect(paymentBlock).not.toBeNull();
    expect(paymentBlock?.className).toContain('w-full');
    expect(paymentBlock?.className).not.toContain('border');
    expect(paymentBlock?.className).not.toContain('bg-');
    expect(
      within(paymentBlock as HTMLDivElement).getByText(bookingModalContent.paymentMethodLabel),
    )
      .toBeInTheDocument();
    const paymentOptions = paymentBlock?.querySelector(
      'div[data-booking-payment-options="true"]',
    ) as HTMLDivElement | null;
    expect(paymentOptions).not.toBeNull();
    expect(paymentOptions?.className).toContain('rounded-[14px]');
    expect(paymentOptions?.className).toContain('border');
    expect(paymentOptions?.className).toContain('es-border-input');
    expect(paymentOptions?.className).toContain('es-bg-surface-white');
    expect(paymentOptions?.className).toContain('p-[10px]');
    expect(paymentOptions?.className).toContain('h-[244px]');
    const paymentOptionsColumns = paymentOptions?.querySelector(
      'div[data-booking-payment-options-columns="true"]',
    ) as HTMLDivElement | null;
    expect(paymentOptionsColumns).not.toBeNull();
    expect(paymentOptionsColumns?.className).toContain('grid');
    expect(paymentOptionsColumns?.className).toContain('grid-cols-5');
    const paymentOptionsLeftColumn = paymentOptions?.querySelector(
      'div[data-booking-payment-options-column-left="true"]',
    ) as HTMLDivElement | null;
    const paymentOptionsRightColumn = paymentOptions?.querySelector(
      'div[data-booking-payment-options-column-right="true"]',
    ) as HTMLDivElement | null;
    expect(paymentOptionsLeftColumn).not.toBeNull();
    expect(paymentOptionsLeftColumn?.className).toContain('col-span-1');
    const paymentOptionsLeftColumnContent = paymentOptionsLeftColumn
      ?.firstElementChild as HTMLDivElement | null;
    expect(paymentOptionsLeftColumnContent?.className).toContain('justify-start');
    expect(paymentOptionsRightColumn).not.toBeNull();
    expect(paymentOptionsRightColumn?.className).toContain('col-span-4');
    expect(paymentOptionsRightColumn?.className).toContain('items-center');
    expect(paymentOptions?.querySelectorAll('li')).toHaveLength(0);
    expect(
      within(paymentOptions as HTMLDivElement).getByText(
        bookingModalContent.paymentConfirmationNote,
      ),
    ).toBeInTheDocument();
    expect(
      within(paymentBlock as HTMLDivElement).getByText(
        bookingModalContent.paymentConfirmationNote,
      ),
    ).toBeInTheDocument();

    const fpsPaymentOption = screen.getByRole('radio', {
      name: bookingModalContent.paymentMethodValue,
    });
    const bankTransferOption = screen.getByRole('radio', {
      name: bookingModalContent.paymentMethodBankTransferValue,
    });
    expect(fpsPaymentOption).toBeChecked();
    expect(bankTransferOption).not.toBeChecked();
    const bankIcon = paymentOptions?.querySelector(
      'img[data-booking-bank-icon="true"]',
    ) as HTMLImageElement | null;
    expect(bankIcon).not.toBeNull();
    expect(bankIcon?.getAttribute('src')).toContain('/images/bank.svg');
    expect(bankIcon?.className).toContain('h-6');
    const fpsIcon = paymentOptions?.querySelector(
      'img[data-booking-fps-icon="true"]',
    ) as HTMLImageElement | null;
    expect(fpsIcon).not.toBeNull();
    expect(fpsIcon?.getAttribute('src')).toContain('/images/fps-logo.svg');
    expect(fpsIcon?.className).toContain('h-[36px]');
    const fpsOptionWrapperClassName = fpsPaymentOption.closest('label')?.className ?? '';
    expect(fpsOptionWrapperClassName).toContain('h-[53px]');
    expect(fpsOptionWrapperClassName).toContain('items-center');
    const bankOptionWrapperClassName = bankTransferOption.closest('label')?.className ?? '';
    expect(bankOptionWrapperClassName).toContain('h-[53px]');
    expect(bankOptionWrapperClassName).toContain('items-center');
    const fpsPaymentDetails = paymentOptions?.querySelector(
      'div[data-booking-payment-details="fps"]',
    ) as HTMLDivElement | null;
    expect(fpsPaymentDetails).not.toBeNull();
    expect(fpsPaymentDetails?.className).toContain('h-full');
    expect(fpsPaymentDetails?.className).toContain('flex-col');
    expect(fpsPaymentDetails?.className).not.toContain('py-');
    expect(fpsPaymentDetails?.className).not.toContain('px-');
    expect(fpsPaymentDetails?.className).not.toContain('bg-');
    expect(
      within(fpsPaymentDetails as HTMLDivElement).getByText(
        bookingModalContent.paymentFpsQrInstruction,
      ),
    ).toBeInTheDocument();
    expect(
      paymentOptions?.querySelector('div[data-booking-payment-details="bank-transfer"]'),
    ).toBeNull();

    expect(paymentBlock?.querySelector('img[alt="FPS"]')).toBeNull();
    const qrCodeContainer = paymentBlock?.querySelector(
      'div[aria-label="FPS payment QR code"]',
    ) as HTMLDivElement | null;
    const fpsLayout = qrCodeContainer?.parentElement as
      | HTMLDivElement
      | null;
    expect(fpsLayout).not.toBeNull();
    expect(fpsLayout?.className).toContain('justify-center');
    expect(fpsLayout?.className).not.toContain('justify-start');
    expect(fpsLayout?.className).not.toContain('gap-');
    expect(fpsLayout?.className).not.toContain('border');
    expect(fpsLayout?.className).not.toContain('bg-');
    expect(qrCodeContainer).not.toBeNull();
    expect(qrCodeContainer?.className).not.toContain('border');
    expect(qrCodeContainer?.className).not.toContain('bg-');

    const submitButton = screen.getByRole('button', {
      name: bookingModalContent.submitLabel,
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(fullNameField, { target: { value: 'Test User' } });
    fireEvent.change(emailField, { target: { value: 'ida@example.com' } });
    fireEvent.change(phoneField, { target: { value: '85212345678' } });
    fireEvent.click(pendingAcknowledgement);
    expect(submitButton).toBeDisabled();
    fireEvent.click(termsAcknowledgement);
    expect(submitButton).toBeDisabled();

    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    expect(submitButton).toBeEnabled();

    const requiredMarkers = screen.getAllByText('*');
    expect(requiredMarkers).toHaveLength(5);

    const paymentBeforeAcknowledgements =
      paymentBlock?.compareDocumentPosition(acknowledgementsBlock ?? paymentBlock) ??
      Node.DOCUMENT_POSITION_DISCONNECTED;
    const acknowledgementsBeforeSubmit =
      acknowledgementsBlock?.compareDocumentPosition(submitButton) ??
      Node.DOCUMENT_POSITION_DISCONNECTED;
    expect(paymentBeforeAcknowledgements & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(acknowledgementsBeforeSubmit & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps left pricing fixed and shows original/discount/confirmed pricing on the right', async () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedValidateDiscountCode.mockResolvedValue({
      code: 'SAVE10',
      type: 'percent',
      value: 10,
    });

    const { container } = renderBookingModal();

    const detailsColumn = container.querySelector(
      '.es-my-best-auntie-booking-modal-details-column',
    ) as HTMLDivElement | null;
    expect(detailsColumn).not.toBeNull();
    expect(within(detailsColumn as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();
    expect(within(detailsColumn as HTMLDivElement).queryByText('Pricing')).not.toBeInTheDocument();
    expect(
      within(detailsColumn as HTMLDivElement).queryByText('Total Amount'),
    ).not.toBeInTheDocument();
    expect(within(detailsColumn as HTMLDivElement).queryByText('Location')).not.toBeInTheDocument();
    expect(within(detailsColumn as HTMLDivElement).getByText('HK$9,000').className).toContain(
      'text-[26px]',
    );
    expect(
      within(detailsColumn as HTMLDivElement).getByText(bookingModalContent.refundHint).className,
    ).toContain('text-base');

    expect(screen.getByText(selectedCohort.location_name)).toBeInTheDocument();
    expect(screen.getByText(selectedCohort.location_address).className).toContain('text-base');
    expect(screen.getByRole('link', { name: bookingModalContent.directionLabel }).className)
      .toContain('text-base');

    const discountInput = screen.getByPlaceholderText(
      bookingModalContent.discountCodePlaceholder,
    ) as HTMLInputElement;
    const applyButton = screen.getByRole('button', {
      name: bookingModalContent.applyDiscountLabel,
    });

    fireEvent.change(discountInput, {
      target: {
        value: 'SAVE10',
      },
    });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(mockedCreateCrmApiClient).toHaveBeenCalledWith();
      expect(mockedValidateDiscountCode).toHaveBeenCalledWith(
        expect.objectContaining({ request: expect.any(Function) }),
        'SAVE10',
      );
      expect(
        screen.getByText(bookingModalContent.discountAppliedLabel),
      ).toBeInTheDocument();
      expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
        'booking_discount_apply_success',
        expect.objectContaining({
          sectionId: 'my-best-auntie-booking',
          ctaLocation: 'discount_code',
        }),
      );
    });

    expect(within(detailsColumn as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();

    const priceBreakdown = container.querySelector(
      'div[data-booking-price-breakdown="true"]',
    ) as HTMLDivElement | null;
    expect(priceBreakdown).not.toBeNull();
    expect(priceBreakdown?.className).toContain('rounded-[14px]');
    expect(priceBreakdown?.className).toContain('border');
    expect(priceBreakdown?.className).toContain('es-border-input');
    expect(priceBreakdown?.className).toContain('es-bg-surface-white');
    expect(priceBreakdown?.className).toContain('p-[10px]');
    expect(within(priceBreakdown as HTMLDivElement).getByText('Price')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Discount')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Confirmed Price')).toBeInTheDocument();
    const breakdownPriceValue = within(priceBreakdown as HTMLDivElement).getByText('HK$9,000');
    expect(breakdownPriceValue).toBeInTheDocument();
    expect(breakdownPriceValue.className).toContain('font-bold');
    expect(within(priceBreakdown as HTMLDivElement).getByText('-HK$900')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('HK$8,100')).toBeInTheDocument();
  });

  it('submits reservation payload with required snake_case fields', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ message: 'Reservation submitted' });
    const onSubmitReservation = vi.fn();
    mockedCreateCrmApiClient.mockReturnValue({
      request: requestSpy,
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });

    renderBookingModal({
      selectedAgeGroupLabel: '18-24 months',
      onSubmitReservation,
    });

    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.fullNameLabel)), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.emailLabel)), {
      target: { value: 'ida@example.com' },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.phoneLabel)), {
      target: { value: '85212345678' },
    });
    fireEvent.change(screen.getByLabelText(bookingModalContent.topicsInterestLabel), {
      target: { value: 'Need details' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: new RegExp(bookingModalContent.pendingReservationAcknowledgementLabel),
      }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: new RegExp(bookingModalContent.termsLinkLabel),
      }),
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: bookingModalContent.submitLabel,
      }),
    );

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith({
        endpointPath: '/v1/legacy/reservations',
        method: 'POST',
        body: {
          full_name: 'Test User',
          email: 'ida@example.com',
          phone_number: '85212345678',
          cohort_age: '18-24 months',
          cohort_date: selectedCohortDate,
          comments: 'Need details',
          discount_code: undefined,
          price: 9000,
          reservation_pending_until_payment_confirmed: true,
          agreed_to_terms_and_conditions: true,
          stripe_payment_intent_id: undefined,
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [200, 202],
      });
    });
    await waitFor(() => {
      expect(onSubmitReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: bookingModalContent.paymentMethodValue,
        }),
      );
      expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
        'booking_submit_success',
        expect.objectContaining({
          sectionId: 'my-best-auntie-booking',
          ctaLocation: 'reservation_form',
        }),
      );
    });
  });

  it('submits selected bank transfer payment method in reservation summary', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ message: 'Reservation submitted' });
    const onSubmitReservation = vi.fn();
    mockedCreateCrmApiClient.mockReturnValue({
      request: requestSpy,
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });

    const { container } = renderBookingModal({
      selectedAgeGroupLabel: '18-24 months',
      onSubmitReservation,
    });

    const bankTransferOption = screen.getByRole('radio', {
      name: bookingModalContent.paymentMethodBankTransferValue,
    });
    fireEvent.click(bankTransferOption);
    expect(bankTransferOption).toBeChecked();
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_payment_method_selected',
      {
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'payment_method',
        params: {
          payment_method: 'bank_transfer',
        },
      },
    );
    expect(
      screen.getByRole('radio', {
        name: bookingModalContent.paymentMethodValue,
      }),
    ).not.toBeChecked();
    expect(container.querySelector('div[aria-label="FPS payment QR code"]')).toBeNull();
    expect(
      screen.getByText(bookingModalContent.paymentBankNameLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByText(bookingModalContent.paymentBankAccountHolderLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByText(bookingModalContent.paymentBankAccountNumberLabel),
    ).toBeInTheDocument();
    const bankTransferPaymentDetails = container.querySelector(
      'div[data-booking-payment-details="bank-transfer"]',
    ) as HTMLDivElement | null;
    expect(bankTransferPaymentDetails).not.toBeNull();
    expect(bankTransferPaymentDetails?.className).toContain('h-full');
    expect(bankTransferPaymentDetails?.className).toContain('flex-col');
    expect(bankTransferPaymentDetails?.className).toContain('items-center');
    expect(bankTransferPaymentDetails?.className).not.toContain('px-');
    expect(bankTransferPaymentDetails?.className).not.toContain('py-');
    expect(bankTransferPaymentDetails?.className).not.toContain('bg-');
    const bankTransferDetailsList = bankTransferPaymentDetails?.querySelector('dl');
    expect(bankTransferDetailsList?.className).toContain('text-center');
    const bankTransferDetailTerms = Array.from(
      bankTransferPaymentDetails?.querySelectorAll('dt') ?? [],
    );
    expect(bankTransferDetailTerms).toHaveLength(3);
    expect(bankTransferDetailTerms[0]?.className).not.toContain('pt-[10px]');
    expect(bankTransferDetailTerms[1]?.className).toContain('pt-[10px]');
    expect(bankTransferDetailTerms[2]?.className).toContain('pt-[10px]');
    expect(screen.getByText(testBankName)).toBeInTheDocument();
    expect(screen.getByText(testBankAccountHolder)).toBeInTheDocument();
    expect(screen.getByText(testBankAccountNumber)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.fullNameLabel)), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.emailLabel)), {
      target: { value: 'ida@example.com' },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.phoneLabel)), {
      target: { value: '85212345678' },
    });
    fireEvent.change(screen.getByLabelText(bookingModalContent.topicsInterestLabel), {
      target: { value: 'Need details' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: new RegExp(bookingModalContent.pendingReservationAcknowledgementLabel),
      }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: new RegExp(bookingModalContent.termsLinkLabel),
      }),
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    fireEvent.click(
      screen.getByRole('button', {
        name: bookingModalContent.submitLabel,
      }),
    );

    await waitFor(() => {
      expect(onSubmitReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: bookingModalContent.paymentMethodBankTransferValue,
        }),
      );
      expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
        'booking_submit_success',
        expect.objectContaining({
          sectionId: 'my-best-auntie-booking',
          ctaLocation: 'reservation_form',
        }),
      );
    });
  });

  it('submits Stripe payment method with payment intent id in reservation payload', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ message: 'Reservation submitted' });
    const onSubmitReservation = vi.fn();
    mockedCreateCrmApiClient.mockReturnValue({
      request: requestSpy,
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedCreateReservationPaymentIntent.mockResolvedValue({
      payment_intent_id: 'pi_test_booking_modal',
      client_secret: 'pi_test_booking_modal_secret_abc',
    });

    renderBookingModal({
      selectedAgeGroupLabel: '18-24 months',
      onSubmitReservation,
      paymentModalContent: bookingModalStripeEnabledContent,
    });

    fireEvent.click(
      screen.getByRole('radio', {
        name: bookingModalStripeEnabledContent.paymentMethodStripeValue,
      }),
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));
    await waitFor(() => {
      expect(mockedCreateReservationPaymentIntent).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.fullNameLabel)), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.emailLabel)), {
      target: { value: 'ida@example.com' },
    });
    fireEvent.change(screen.getByLabelText(new RegExp(bookingModalContent.phoneLabel)), {
      target: { value: '85212345678' },
    });
    fireEvent.change(screen.getByLabelText(bookingModalContent.topicsInterestLabel), {
      target: { value: 'Need details' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: new RegExp(bookingModalContent.pendingReservationAcknowledgementLabel),
      }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: new RegExp(bookingModalContent.termsLinkLabel),
      }),
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: bookingModalContent.submitStripeLabel,
      }),
    );

    await waitFor(() => {
      expect(requestSpy).toHaveBeenCalledWith({
        endpointPath: '/v1/legacy/reservations',
        method: 'POST',
        body: {
          full_name: 'Test User',
          email: 'ida@example.com',
          phone_number: '85212345678',
          cohort_age: '18-24 months',
          cohort_date: selectedCohortDate,
          comments: 'Need details',
          discount_code: undefined,
          price: 9000,
          reservation_pending_until_payment_confirmed: true,
          agreed_to_terms_and_conditions: true,
          stripe_payment_intent_id: 'pi_test_booking_modal',
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [200, 202],
      });
    });
    await waitFor(() => {
      expect(onSubmitReservation).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethod: bookingModalStripeEnabledContent.paymentMethodStripeValue,
        }),
      );
    });
  });

  it('shows Stripe loading copy before captcha is solved', () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });

    renderBookingModal({
      paymentModalContent: bookingModalStripeEnabledContent,
    });

    fireEvent.click(
      screen.getByRole('radio', {
        name: bookingModalStripeEnabledContent.paymentMethodStripeValue,
      }),
    );

    expect(
      screen.getByText(bookingModalStripeEnabledContent.paymentMethodStripeLoadingLabel),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(bookingModalStripeEnabledContent.paymentMethodStripeUnavailableLabel),
    ).not.toBeInTheDocument();
  });

  it('passes branded appearance options to Stripe Elements', async () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedCreateReservationPaymentIntent.mockResolvedValue({
      payment_intent_id: 'pi_test_booking_modal',
      client_secret: 'pi_test_booking_modal_secret_abc',
    });

    renderBookingModal({
      paymentModalContent: bookingModalStripeEnabledContent,
    });

    fireEvent.click(
      screen.getByRole('radio', {
        name: bookingModalStripeEnabledContent.paymentMethodStripeValue,
      }),
    );
    fireEvent.click(screen.getByTestId('mock-turnstile-captcha-solve'));

    await waitFor(() => {
      expect(screen.getByTestId('mock-stripe-payment-element')).toBeInTheDocument();
      expect(mockedStripePaymentElementProps).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            layout: 'accordion',
          }),
        }),
      );
      expect(mockedStripeElementsProps).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            clientSecret: 'pi_test_booking_modal_secret_abc',
            appearance: expect.objectContaining({
              theme: 'stripe',
              variables: expect.objectContaining({
                colorPrimary: '#C84A16',
                colorBackground: '#FFFFFF',
                colorText: '#333333',
                colorTextSecondary: '#5A5A5A',
                colorTextPlaceholder: '#8A8A8A',
                colorDanger: '#B42318',
                fontFamily:
                  'Lato, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                borderRadius: '10px',
                spacingUnit: '4px',
              }),
              rules: expect.objectContaining({
                '.Label': expect.objectContaining({
                  color: '#333333',
                  fontWeight: '600',
                }),
                '.Input': expect.objectContaining({
                  border: '1px solid #CAD6E5',
                }),
                '.Input:focus': expect.objectContaining({
                  borderColor: '#C84A16',
                  boxShadow: '0 0 0 1px #FFFFFF, 0 0 0 3px rgba(200, 74, 22, 0.55)',
                }),
                '.Input:focus-visible': expect.objectContaining({
                  borderColor: '#C84A16',
                  boxShadow: '0 0 0 1px #FFFFFF, 0 0 0 3px rgba(200, 74, 22, 0.55)',
                }),
                '.Error': expect.objectContaining({
                  color: '#B42318',
                }),
                '.Tab': expect.objectContaining({
                  backgroundColor: '#F8F8F8',
                  border: '1px solid #CAD6E5',
                  color: '#333333',
                }),
                '.Tab:focus': expect.objectContaining({
                  borderColor: '#C84A16',
                  boxShadow: '0 0 0 1px #FFFFFF, 0 0 0 3px rgba(200, 74, 22, 0.55)',
                }),
                '.Tab:focus-visible': expect.objectContaining({
                  borderColor: '#C84A16',
                  boxShadow: '0 0 0 1px #FFFFFF, 0 0 0 3px rgba(200, 74, 22, 0.55)',
                }),
                '.Tab--selected': expect.objectContaining({
                  backgroundColor: '#FFFFFF',
                  borderColor: '#C84A16',
                  boxShadow: '0 0 0 1px #FFFFFF, 0 0 0 2px rgba(200, 74, 22, 0.65)',
                  color: '#333333',
                }),
              }),
            }),
          }),
        }),
      );
    });
  });

  it('uses calendar mask icons inside each course part chip', () => {
    const { container } = renderBookingModal();

    const partIcons = Array.from(
      container.querySelectorAll('span[data-course-part-icon="true"]'),
    );
    expect(partIcons).toHaveLength(3);
    for (const icon of partIcons) {
      expect(icon.className).toContain('es-mask-calendar-current');
    }
  });

  it('renders one schedule block per course part and no support detail rows', () => {
    const { container } = renderBookingModal();

    expect(
      container.querySelectorAll('img[data-course-part-support-icon="true"]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('span[data-course-part-support-chip="true"]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('p[data-course-part-detail-title="true"]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('p[data-course-part-detail-description="true"]'),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('span[data-course-part-line="support-gap-connector"]'),
    ).toHaveLength(0);

    const scheduleBlocks = container.querySelectorAll(
      'p[data-course-part-schedule-block="true"]',
    );
    expect(scheduleBlocks).toHaveLength(3);
    expect(scheduleBlocks[0]?.textContent).toContain('Group session:');
    expect(scheduleBlocks[0]?.textContent).toContain('Home visit:');
    expect(scheduleBlocks[0]?.textContent).toContain('Parent call:');
  });

  it('renders timeline segments, 50px part spacing, and numeric part chips', () => {
    const { container } = renderBookingModal();
    const timelineList = container.querySelector('ul.space-y-\\[50px\\]');
    expect(timelineList).not.toBeNull();

    const timelineSegments = container.querySelectorAll(
      'span[data-course-part-line="segment"]',
    );
    const gapConnectors = container.querySelectorAll(
      'span[data-course-part-line="gap-connector"]',
    );
    expect(timelineSegments).toHaveLength(3);
    expect(gapConnectors).toHaveLength(3);
    expect(
      container.querySelectorAll('span[data-course-part-line="connector"]'),
    ).toHaveLength(0);

    const [firstSegment, secondSegment, thirdSegment] = Array.from(timelineSegments);
    expect(firstSegment?.className).toContain('es-my-best-auntie-booking-part-line');
    expect(firstSegment?.className).toContain(
      'es-my-best-auntie-booking-part-line--tone-blue',
    );
    expect(firstSegment?.className).toContain(
      'es-my-best-auntie-booking-part-line--with-gap-first',
    );
    expect(secondSegment?.className).toContain(
      'es-my-best-auntie-booking-part-line--tone-green',
    );
    expect(secondSegment?.className).toContain(
      'es-my-best-auntie-booking-part-line--with-gap-stacked',
    );
    expect(thirdSegment?.className).toContain(
      'es-my-best-auntie-booking-part-line--tone-yellow',
    );
    expect(thirdSegment?.className).toContain(
      'es-my-best-auntie-booking-part-line--last-stacked',
    );

    for (const connector of gapConnectors) {
      const className = connector.getAttribute('class');
      expect(className).toContain('es-my-best-auntie-booking-part-gap-connector');
      expect(className).toContain('top-1/2');
      expect(className).toContain('-translate-y-1/2');
      expect(className).toContain('-left-[25px]');
    }

    expect(
      container.querySelectorAll('span[data-course-part-label="true"]'),
    ).toHaveLength(0);

    const partChips = Array.from(
      container.querySelectorAll('span[data-course-part-chip="true"]'),
    );
    expect(partChips).toHaveLength(3);
    const firstPartChip = partChips[0] as HTMLSpanElement | undefined;
    expect(firstPartChip?.className).toContain('px-3');

    const firstPartItem = firstPartChip?.closest('li') ?? null;
    expect(firstPartItem?.className).toContain('es-my-best-auntie-booking-part-item');
    const firstPartIcon = firstPartItem?.querySelector(
      'span[data-course-part-icon="true"]',
    ) as HTMLSpanElement | null;
    expect(firstPartIcon).not.toBeNull();
    expect(firstPartIcon?.className).toContain('es-mask-calendar-current');

    const firstPartRow = firstPartChip?.closest('div');
    expect(firstPartRow?.className).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(firstPartRow?.className).toContain('items-start');

    const firstPartDateBlock = firstPartItem?.querySelector(
      'div[data-course-part-date-block="true"]',
    ) as HTMLDivElement | null;
    expect(firstPartDateBlock).not.toBeNull();
    expect(firstPartDateBlock?.className).toContain('flex');
    expect(firstPartDateBlock?.className).toContain('flex-col');
    expect(firstPartDateBlock?.className).toContain('gap-2');
    expect(
      firstPartDateBlock?.querySelector('span[data-course-part-date-icon="true"]'),
    ).toBeNull();

    const firstPartDateText = firstPartDateBlock?.querySelector('p');
    expect(firstPartDateText?.className).toContain('min-w-0');

    const firstConnector = firstPartChip?.querySelector(
      'span[data-course-part-line="gap-connector"]',
    );
    expect(firstConnector).not.toBeNull();
  });

  it('does not render booking modal copyright footer section', () => {
    const { container } = renderBookingModal();

    expect(screen.queryByText('2026 Evolve Sprouts')).not.toBeInTheDocument();
    expect(screen.queryByText(/©/u)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-b border-black/10');
  });

  it('renders modal column logos as section backgrounds instead of image elements', () => {
    const { container } = renderBookingModal();

    expect(container.querySelector('img[src="/images/evolvesprouts-logo.svg"]')).toBeNull();
    expect(
      container.querySelector('.es-my-best-auntie-booking-modal-details-column'),
    ).not.toBeNull();
    expect(
      container.querySelector('.es-my-best-auntie-booking-modal-reservation-panel'),
    ).not.toBeNull();
  });

  it('renders shared external link icon and updated booking icons', () => {
    const { container } = renderBookingModal();

    const directionLink = screen.getByRole('link', {
      name: bookingModalContent.directionLabel,
    });

    expect(directionLink).toHaveAttribute('href', selectedCohort.location_url);
    expect(directionLink).toHaveTextContent(bookingModalContent.directionLabel);
    expect(screen.getByText(bookingModalContent.directionLabel).className).toContain(
      'es-link-external-label',
    );
    expect(screen.getByText(bookingModalContent.directionLabel).className).toContain(
      'es-link-external-label--direction',
    );
    const directionIcon = directionLink.querySelector('.es-ui-icon-mask--external-link');
    expect(directionIcon).not.toBeNull();
    expect(directionIcon?.getAttribute('class')).toContain('es-link-external-icon');

    const termsLink = screen.getByRole('link', {
      name: bookingModalContent.termsLinkLabel,
    });
    expect(termsLink).toHaveAttribute('href', bookingModalContent.termsHref);
    expect(termsLink).toHaveAttribute('target', '_blank');
    expect(termsLink).toHaveAttribute('rel', 'noopener');
    expect(termsLink.querySelector('.es-ui-icon-mask--external-link')).toBeNull();
    expect(
      screen.queryByRole('link', {
        name: bookingSectionContent.learnMoreLabel,
      }),
    ).toBeNull();

    expect(container.querySelector('span.es-mask-dollar-danger')).not.toBeNull();
    expect(container.querySelector('span.es-mask-location-danger')).not.toBeNull();
    expect(container.querySelectorAll('div.border-b.border-black\\/15')).toHaveLength(1);
  });

  it('does not render thank-you modal copyright footer section', () => {
    const { container } = renderWithPortalContainer(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        onClose={() => {}}
      />,
    );

    expect(
      screen.queryByText(`${new Date().getFullYear()} Evolve Sprouts`),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/©/u)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-t border-black/10');
    expect(container.querySelector('img[src="/images/evolvesprouts-logo.svg"]')).toBeNull();
  });

  it('renders thank-you detail cards and directions link', () => {
    const { container } = renderWithPortalContainer(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        onClose={() => {}}
      />,
    );

    expect(container.querySelectorAll('.es-booking-thank-you-detail-card')).toHaveLength(4);
    expect(
      container.querySelector('.es-booking-thank-you-detail-icon-mask--training'),
    ).not.toBeNull();
    expect(
      container.querySelector('.es-booking-thank-you-detail-icon-mask--calendar'),
    ).not.toBeNull();
    expect(
      container.querySelector('.es-booking-thank-you-detail-icon-mask--location'),
    ).not.toBeNull();
    expect(
      container.querySelector('.es-booking-thank-you-detail-icon-mask--dollar'),
    ).not.toBeNull();
    expect(screen.getByText(reservationSummary.eventTitle)).toBeInTheDocument();
    expect(screen.getByText(myBestAuntieModalContent.subtitle)).toBeInTheDocument();
    const sessionLines =
      reservationSummary.courseSessions?.map((session) => {
        const datePart = formatSiteCompactDate(session.dateStartTime, 'en');
        const timePart = formatSiteTimeOfDay(session.dateStartTime, 'en');
        return `${datePart}, ${timePart}`;
      }) ?? [];
    expect(sessionLines).toHaveLength(2);
    for (const line of sessionLines) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.getByText(thankYouModalContent.paymentConfirmationNote)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: thankYouModalContent.downloadCalendarInviteLabel,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(selectedCohort.location_name)).toBeInTheDocument();
    expect(screen.getByText(selectedCohort.location_address)).toBeInTheDocument();
    const directionLink = screen.getByRole('link', {
      name: thankYouModalContent.directionLabel,
    });
    expect(directionLink).toHaveAttribute('href', reservationSummary.locationDirectionHref);
  });

  it('renders WhatsApp follow-up when href and label are provided', () => {
    render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        whatsappHref='https://wa.me/85294479843'
        whatsappCtaLabel={enContent.contactUs.form.contactMethodLinks.whatsapp}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText(thankYouModalContent.followUpPrompt)).toBeInTheDocument();
    const whatsappLink = screen.getByRole('link', {
      name: enContent.contactUs.form.contactMethodLinks.whatsapp,
    });
    expect(whatsappLink).toHaveAttribute('href', 'https://wa.me/85294479843');
  });

  it('tracks thank-you calendar download clicks', () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        onClose={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: thankYouModalContent.downloadCalendarInviteLabel,
      }),
    );

    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_thank_you_ics_download',
      expect.objectContaining({
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'thank_you_modal',
      }),
    );

    createObjectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('allows only one discount code to be applied at a time', async () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedCreatePublicApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedValidateDiscountCode.mockResolvedValue({
      code: 'SAVE10',
      type: 'percent',
      value: 10,
    });

    renderBookingModal();

    const discountInput = screen.getByPlaceholderText(
      bookingModalContent.discountCodePlaceholder,
    ) as HTMLInputElement;
    const applyButton = screen.getByRole('button', {
      name: bookingModalContent.applyDiscountLabel,
    });

    fireEvent.change(discountInput, {
      target: {
        value: 'SAVE10',
      },
    });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(
        screen.getByText(bookingModalContent.discountAppliedLabel),
      ).toBeInTheDocument();
    });

    expect(discountInput).toBeDisabled();
    expect(applyButton).toBeDisabled();
    expect(discountInput.value).toBe('SAVE10');
  });
});
