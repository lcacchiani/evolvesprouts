/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MyBestAuntieBookingModal,
  MyBestAuntieThankYouModal,
  type ReservationSummary,
} from '@/components/sections/my-best-auntie-booking-modal';
import enContent from '@/content/en.json';
import { createCrmApiClient } from '@/lib/crm-api-client';
import { fetchDiscountRules } from '@/lib/discounts-data';

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
    createCrmApiClient: vi.fn(() => null),
  };
});

vi.mock('@/lib/discounts-data', async () => {
  const actual = await vi.importActual<typeof import('@/lib/discounts-data')>(
    '@/lib/discounts-data',
  );

  return {
    ...actual,
    fetchDiscountRules: vi.fn(),
  };
});

const bookingModalContent = enContent.myBestAuntieBooking.paymentModal;
const thankYouModalContent = enContent.myBestAuntieBooking.thankYouModal;
const mockedCreateCrmApiClient = vi.mocked(createCrmApiClient);
const mockedFetchDiscountRules = vi.mocked(fetchDiscountRules);

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

afterEach(() => {
  mockedCreateCrmApiClient.mockReturnValue(null);
  mockedFetchDiscountRules.mockReset();
});

describe('my-best-auntie booking modals footer content', () => {
  it('hides child age group and payment method in booking modal', () => {
    render(
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
      screen.queryByText(bookingModalContent.paymentMethodLabel),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(bookingModalContent.paymentMethodValue),
    ).not.toBeInTheDocument();
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
    expect(
      container.querySelectorAll('span[style*="/images/calendar.svg"]').length,
    ).toBeGreaterThan(0);
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
    render(
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

    const fpsBlock = screen.getByText('FPS QR').closest(
      'div[data-booking-fps-block="true"]',
    ) as HTMLDivElement | null;
    expect(fpsBlock).not.toBeNull();
    expect(fpsBlock?.className).not.toContain('border');
    expect(fpsBlock?.className).not.toContain('bg-');

    const submitButton = screen.getByRole('button', {
      name: bookingModalContent.submitLabel,
    });
    expect(submitButton).toBeDisabled();

    fireEvent.change(fullNameField, { target: { value: 'Ida De Gregorio' } });
    fireEvent.change(emailField, { target: { value: 'ida@example.com' } });
    fireEvent.change(phoneField, { target: { value: '85297942094' } });
    fireEvent.click(pendingAcknowledgement);
    expect(submitButton).toBeDisabled();
    fireEvent.click(termsAcknowledgement);
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
    mockedFetchDiscountRules.mockResolvedValue([
      {
        code: 'SAVE10',
        type: 'percent',
        value: 10,
      },
    ]);

    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mockedFetchDiscountRules).toHaveBeenCalledTimes(1);
    });

    const pricingSection = screen
      .getByRole('heading', { name: bookingModalContent.pricingTitle })
      .closest('div') as HTMLDivElement | null;
    expect(pricingSection).not.toBeNull();
    expect(within(pricingSection as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();

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

    expect(within(pricingSection as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();

    const priceBreakdown = container.querySelector(
      'div[data-booking-price-breakdown="true"]',
    ) as HTMLDivElement | null;
    expect(priceBreakdown).not.toBeNull();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Original Price')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Discount')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('Confirmed Price')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('HK$9,000')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('-HK$900')).toBeInTheDocument();
    expect(within(priceBreakdown as HTMLDivElement).getByText('HK$8,100')).toBeInTheDocument();
  });

  it('uses cubes.svg mask icon for all course part chips', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    expect(container.querySelectorAll('span[style*="/images/cubes.svg"]')).toHaveLength(3);
  });

  it('renders overlapping rounded timeline segments and 10px gap connectors', () => {
    const { container } = render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

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

    for (const [index, segment] of Array.from(timelineSegments).entries()) {
      const style = segment.getAttribute('style');
      expect(style).toContain('width: 25px');
      expect(style).toContain('border-top-left-radius: 999px');
      expect(style).toContain('border-top-right-radius: 999px');
      expect(style).toContain(`z-index: ${index + 1}`);
      if (index > 0) {
        expect(style).toContain('top: -12px');
        expect(style).toContain('box-shadow: 0 -5px 0 0 #FFFFFF');
      }
    }

    for (const connector of gapConnectors) {
      const style = connector.getAttribute('style');
      const className = connector.getAttribute('class');
      expect(style).toContain('width: 25px');
      expect(style).toContain('height: 10px');
      expect(className).toContain('top-1/2');
      expect(className).toContain('-translate-y-1/2');
      expect(className).toContain('-left-[25px]');
    }

    const firstPartItem = screen.getByText(bookingModalContent.parts[0].label).closest('li');
    expect(firstPartItem?.getAttribute('style')).toContain('padding-left: 50px');
    expect(firstPartItem?.getAttribute('style')).toContain('padding-bottom: 100px');
    expect(firstPartItem?.querySelector('img')).toBeNull();

    const firstPartChip = firstPartItem?.querySelector(
      'span[data-course-part-chip="true"]',
    ) as HTMLSpanElement | null;
    expect(firstPartChip?.className).toContain('self-start');

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
      'underline',
    );
    const directionIcon = directionLink.querySelector(
      'svg[data-external-link-icon="true"]',
    );
    expect(
      directionIcon,
    ).not.toBeNull();
    expect(directionIcon?.getAttribute('class')).toContain('border-b');
    expect(
      container.querySelector('span[style*="/images/credit-card.svg"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('span[style*="/images/target.svg"]'),
    ).not.toBeNull();
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

    expect(
      container.querySelector('span[style*="/images/calendar.svg"]'),
    ).not.toBeNull();
  });

  it('allows only one discount code to be applied at a time', async () => {
    mockedCreateCrmApiClient.mockReturnValue({
      request: vi.fn(),
    });
    mockedFetchDiscountRules.mockResolvedValue([
      {
        code: 'SAVE10',
        type: 'percent',
        value: 10,
      },
    ]);

    render(
      <MyBestAuntieBookingModal
        content={bookingModalContent}
        onClose={() => {}}
        onSubmitReservation={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mockedFetchDiscountRules).toHaveBeenCalledTimes(1);
    });

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
