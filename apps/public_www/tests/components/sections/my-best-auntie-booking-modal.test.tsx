/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { originalFpsMerchantName, originalFpsMobileNumber } = vi.hoisted(() => {
  const originalFpsMerchantName = process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME;
  const originalFpsMobileNumber = process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER;

  process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME = 'Test FPS Merchant';
  process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER = '85200000000';

  return {
    originalFpsMerchantName,
    originalFpsMobileNumber,
  };
});

import {
  MyBestAuntieBookingModal,
  MyBestAuntieThankYouModal,
  type ReservationSummary,
} from '@/components/sections/my-best-auntie-booking-modal';
import enContent from '@/content/en.json';
import { createPublicCrmApiClient } from '@/lib/crm-api-client';
import { validateDiscountCode } from '@/lib/discounts-data';

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

vi.mock('@/lib/crm-api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/crm-api-client')>(
    '@/lib/crm-api-client',
  );

  return {
    ...actual,
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

const bookingModalContent = enContent.myBestAuntieBooking.paymentModal;
const thankYouModalContent = enContent.myBestAuntieBooking.thankYouModal;
const mockedCreateCrmApiClient = vi.mocked(createPublicCrmApiClient);
const mockedValidateDiscountCode = vi.mocked(validateDiscountCode);
const testTurnstileSiteKey = 'test-turnstile-site-key';
const testFpsMerchantName = 'Test FPS Merchant';
const testFpsMobileNumber = '85200000000';
const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const reservationSummary: ReservationSummary = {
  attendeeName: 'Test User',
  attendeeEmail: 'test@example.com',
  attendeePhone: '12345678',
  childAgeGroup: '18-24 months',
  packageLabel: 'Standard Package',
  monthLabel: 'April',
  paymentMethod: 'Pay via FPS QR',
  totalAmount: 9000,
  courseLabel: 'My Best Auntie',
  scheduleDateLabel: 'April',
  scheduleTimeLabel: '12:00 pm - 2:00 pm',
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = testTurnstileSiteKey;
  process.env.NEXT_PUBLIC_FPS_MERCHANT_NAME = testFpsMerchantName;
  process.env.NEXT_PUBLIC_FPS_MOBILE_NUMBER = testFpsMobileNumber;
});

afterEach(() => {
  mockedCreateCrmApiClient.mockReturnValue(null);
  mockedValidateDiscountCode.mockReset();

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
});

describe('my-best-auntie booking modals footer content', () => {
  it('exposes labelled dialog semantics for booking and thank-you modals', () => {
    const bookingModalView = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const bookingDialog = screen.getByRole('dialog', {
      name: bookingModalContent.title,
    });
    const bookingDescriptionId = bookingDialog.getAttribute('aria-describedby');
    expect(bookingDialog).toHaveAttribute('aria-labelledby');
    expect(bookingDescriptionId).toBeTruthy();
    expect(document.getElementById(bookingDescriptionId ?? '')).not.toBeNull();

    bookingModalView.unmount();

    render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        homeHref='/en'
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
    ).toContain(thankYouModalContent.subtitle);
  });

  it('hides child age group and renders payment option label in booking modal', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        selectedAgeGroupLabel='18-24 months'
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(
      screen.queryByText(bookingModalContent.selectedAgeGroupLabel),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('18-24 months')).not.toBeInTheDocument();
    expect(
      screen.getByText(bookingModalContent.paymentMethodLabel),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(bookingModalContent.paymentMethodValue),
    ).not.toBeInTheDocument();

    const fpsBlock = container.querySelector(
      'div[data-booking-fps-block="true"]',
    ) as HTMLDivElement | null;
    expect(fpsBlock).not.toBeNull();
    expect(within(fpsBlock as HTMLDivElement).getByText(bookingModalContent.paymentMethodLabel))
      .toBeInTheDocument();
  });

  it('does not render course schedule heading and uses shared calendar icon in booking modal', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(screen.queryByText('Course Schedule')).not.toBeInTheDocument();
    expect(container.querySelectorAll('span.es-mask-calendar-heading').length).toBeGreaterThan(
      0,
    );
  });

  it('does not render the month/package selector box in booking modal', () => {
    render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(
      screen.queryByRole('heading', { name: bookingModalContent.monthLabel }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: bookingModalContent.packageLabel }),
    ).not.toBeInTheDocument();

    for (const option of bookingModalContent.packageOptions) {
      expect(screen.queryByText(option.description)).not.toBeInTheDocument();
    }
  });

  it('renders topics textarea and required acknowledgement checkboxes', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

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

    const fpsBlock = container.querySelector(
      'div[data-booking-fps-block="true"]',
    ) as HTMLDivElement | null;
    expect(fpsBlock).not.toBeNull();
    expect(fpsBlock?.className).toContain('w-full');
    expect(fpsBlock?.className).not.toContain('border');
    expect(fpsBlock?.className).not.toContain('bg-');
    expect(within(fpsBlock as HTMLDivElement).getByText(bookingModalContent.paymentMethodLabel))
      .toBeInTheDocument();

    const fpsLayout = fpsBlock?.querySelector('img[alt="FPS"]')?.parentElement as
      | HTMLDivElement
      | null;
    expect(fpsLayout).not.toBeNull();
    expect(fpsLayout?.className).toContain('justify-start');
    expect(fpsLayout?.className).toContain('gap-2');
    expect(fpsLayout?.className).not.toContain('border');
    expect(fpsLayout?.className).not.toContain('bg-');

    const qrCodeContainer = fpsLayout?.querySelector(
      'div[aria-label="FPS payment QR code"]',
    ) as HTMLDivElement | null;
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

    const fpsBeforeAcknowledgements =
      fpsBlock?.compareDocumentPosition(acknowledgementsBlock ?? fpsBlock) ??
      Node.DOCUMENT_POSITION_DISCONNECTED;
    const acknowledgementsBeforeSubmit =
      acknowledgementsBlock?.compareDocumentPosition(submitButton) ??
      Node.DOCUMENT_POSITION_DISCONNECTED;
    expect(fpsBeforeAcknowledgements & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(acknowledgementsBeforeSubmit & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps left pricing fixed and shows original/discount/confirmed pricing on the right', async () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedValidateDiscountCode.mockResolvedValue({
      code: 'SAVE10',
      type: 'percent',
      value: 10,
    });

    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const pricingSection = screen
      .getByRole('heading', { name: bookingModalContent.pricingTitle })
      .closest('div') as HTMLDivElement | null;
    expect(pricingSection).not.toBeNull();
    expect(within(pricingSection as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();
    const pricingHeading = screen.getByRole('heading', {
      level: 3,
      name: bookingModalContent.pricingTitle,
    });
    expect(pricingHeading.className).toContain('text-2xl');
    expect(
      within(pricingSection as HTMLDivElement).getByText(bookingModalContent.totalAmountLabel)
        .className,
    ).toContain('text-lg');
    expect(within(pricingSection as HTMLDivElement).getByText('HK$9,000').className).toContain(
      'text-[26px]',
    );
    expect(within(pricingSection as HTMLDivElement).getByText(bookingModalContent.refundHint).className)
      .toContain('text-base');

    const locationHeading = screen.getByRole('heading', {
      level: 3,
      name: bookingModalContent.locationTitle,
    });
    expect(locationHeading.className).toContain('text-2xl');
    expect(screen.getByText(bookingModalContent.locationName).className).toContain('text-lg');
    expect(screen.getByText(bookingModalContent.locationAddress).className).toContain('text-base');
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
      expect(mockedValidateDiscountCode).toHaveBeenCalledWith(
        expect.objectContaining({ request: expect.any(Function) }),
        'SAVE10',
      );
      expect(
        screen.getByText(bookingModalContent.discountAppliedLabel),
      ).toBeInTheDocument();
    });

    expect(within(pricingSection as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();

    const priceBreakdown = container.querySelector(
      'div[data-booking-price-breakdown="true"]',
    ) as HTMLDivElement | null;
    expect(priceBreakdown).not.toBeNull();
    expect(priceBreakdown?.className).not.toContain('border');
    expect(priceBreakdown?.className).not.toContain('bg-');
    expect(within(priceBreakdown as HTMLDivElement).getByText('Price')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Discount')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Confirmed Price')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('-HK$900')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('HK$8,100')).toBeInTheDocument();
  });

  it('submits reservation payload with required snake_case fields', async () => {
    const requestSpy = vi.fn().mockResolvedValue({ message: 'Reservation submitted' });
    mockedCreateCrmApiClient.mockReturnValue({
      request: requestSpy,
    });

    render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        selectedAgeGroupLabel='18-24 months'
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

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
        endpointPath: '/v1/reservations',
        method: 'POST',
        body: {
          full_name: 'Test User',
          email: 'ida@example.com',
          phone_number: '85212345678',
          cohort_age: '18-24 months',
          cohort_date: '2026-04-08',
          comments: 'Need details',
          discount_code: undefined,
          price: 9000,
          reservation_pending_until_payment_confirmed: true,
          agreed_to_terms_and_conditions: true,
        },
        turnstileToken: 'mock-turnstile-token',
        expectedSuccessStatuses: [200, 202],
      });
    });
  });

  it('uses my best auntie overview icons for all course part chips', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const partIcons = Array.from(
      container.querySelectorAll('img[data-course-part-icon="true"]'),
    );
    expect(partIcons).toHaveLength(3);
    expect(partIcons.map((icon) => icon.getAttribute('src'))).toEqual([
      '/images/home.svg',
      '/images/limits.svg',
      '/images/independence.svg',
    ]);
  });

  it('renders timeline segments, 50px part spacing, and numeric part chips', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );
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
    expect(firstPartChip?.className).toContain('self-start');
    expect(firstPartChip?.className).toContain('px-3');

    const firstPartItem = firstPartChip?.closest('li') ?? null;
    expect(firstPartItem?.className).toContain('es-my-best-auntie-booking-part-item');
    const firstPartIcon = firstPartItem?.querySelector(
      'img[data-course-part-icon="true"]',
    ) as HTMLImageElement | null;
    expect(firstPartIcon).not.toBeNull();
    expect(firstPartIcon?.getAttribute('src')).toBe('/images/home.svg');

    const firstPartRow = firstPartChip?.closest('div');
    expect(firstPartRow?.className).toContain('sm:items-start');

    const firstPartDateBlock = firstPartItem?.querySelector(
      'div[data-course-part-date-block="true"]',
    ) as HTMLDivElement | null;
    expect(firstPartDateBlock).not.toBeNull();
    expect(firstPartDateBlock?.className).not.toContain('flex');

    const firstPartDateIcon = firstPartDateBlock?.querySelector(
      'span[data-course-part-date-icon="true"]',
    ) as HTMLSpanElement | null;
    expect(firstPartDateIcon?.className).toContain('h-6');
    expect(firstPartDateIcon?.className).toContain('inline-block');

    const firstPartDateText = firstPartDateBlock?.querySelector('p');
    expect(firstPartDateText?.className).toContain('mt-1');

    const firstConnector = firstPartChip?.querySelector(
      'span[data-course-part-line="gap-connector"]',
    );
    expect(firstConnector).not.toBeNull();
  });

  it('does not render booking modal copyright footer section', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(screen.queryByText('2026 Evolve Sprouts')).not.toBeInTheDocument();
    expect(screen.queryByText(/©/u)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-b border-black/10');
  });

  it('renders shared external link icon and updated booking icons', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    const directionLink = screen.getByRole('link', {
      name: bookingModalContent.directionLabel,
    });

    expect(directionLink).toHaveAttribute('href', bookingModalContent.directionHref);
    expect(directionLink).toHaveTextContent(bookingModalContent.directionLabel);
    expect(screen.getByText(bookingModalContent.directionLabel).className).toContain(
      'es-link-external-label',
    );
    const directionIcon = directionLink.querySelector(
      'svg[data-external-link-icon="true"]',
    );
    expect(directionIcon).not.toBeNull();
    expect(directionIcon?.getAttribute('class')).toContain('es-link-external-icon');

    const termsLink = screen.getByRole('link', {
      name: bookingModalContent.termsLinkLabel,
    });
    expect(termsLink).toHaveAttribute('href', bookingModalContent.termsHref);
    expect(termsLink).toHaveAttribute('target', '_blank');
    expect(termsLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      termsLink.querySelector('svg[data-external-link-icon="true"]'),
    ).toBeNull();

    expect(container.querySelector('span.es-mask-credit-card-danger')).not.toBeNull();
    expect(container.querySelector('span.es-mask-target-danger')).not.toBeNull();
    expect(container.querySelectorAll('div.border-b.border-black\\/15')).toHaveLength(2);
  });

  it('does not render thank-you modal copyright footer section', () => {
    const { container } = render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        homeHref='/en'
        onClose={() => {}}
      />,
    );

    expect(
      screen.queryByText(`${new Date().getFullYear()} Evolve Sprouts`),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/©/u)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('border-t border-black/10');
  });

  it('uses shared calendar icon in thank-you modal summary chip', () => {
    const { container } = render(
      <MyBestAuntieThankYouModal
        locale='en'
        content={thankYouModalContent}
        summary={reservationSummary}
        homeHref='/en'
        onClose={() => {}}
      />,
    );

    expect(container.querySelector('span.es-mask-calendar-heading')).not.toBeNull();
  });

  it('allows only one discount code to be applied at a time', async () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedValidateDiscountCode.mockResolvedValue({
      code: 'SAVE10',
      type: 'percent',
      value: 10,
    });

    render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

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
