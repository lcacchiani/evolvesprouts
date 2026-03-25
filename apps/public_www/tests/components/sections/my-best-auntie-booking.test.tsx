/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie/my-best-auntie-booking';
import enContent from '@/content/en.json';
import trainingCoursesContent from '@/content/my-best-auntie-training-courses.json';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { formatCohortValue, formatPartDateTimeLabel } from '@/lib/format';
import { buildWhatsappPrefilledHref } from '@/lib/site-config';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
  trackEcommerceEvent: vi.fn(),
}));

const mockedTrackAnalyticsEvent = vi.mocked(trackAnalyticsEvent);

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  mockedTrackAnalyticsEvent.mockReset();
});

function formatCohortPreviewLabel(value: string): string {
  const firstDateSegment = value.split(/\s+-\s+/)[0]?.trim() ?? value.trim();

  return firstDateSegment.replace(/\s+(am|pm)$/i, '$1');
}

function formatNextCohortLabel(scheduleLabel: string, ageGroupLabel: string): string {
  return `${scheduleLabel} for ${ageGroupLabel} age group`;
}

type BookingContent = typeof enContent.myBestAuntie.booking & {
  cohorts: typeof trainingCoursesContent.data;
};
type BookingCohort = BookingContent['cohorts'][number];

const bookingContent = {
  ...enContent.myBestAuntie.booking,
  cohorts: trainingCoursesContent.data,
} as BookingContent;
const myBestAuntieModalContent = enContent.myBestAuntie.modal;
const bookingModalContent = enContent.bookingModal;
const privateProgrammeWhatsappHref = buildWhatsappPrefilledHref(
  enContent.freeIntroSession.ctaHref,
  bookingContent.privateProgrammePrefillMessage,
  enContent.freeIntroSession.phoneNumber,
) || enContent.freeIntroSession.ctaHref;

function getCohortsForAge(content: BookingContent, ageGroupId: string): BookingCohort[] {
  return content.cohorts
    .filter((cohort) => cohort.age_group === ageGroupId)
    .sort((left, right) => {
      const leftDate = Date.parse(left.dates[0]?.start_datetime ?? '');
      const rightDate = Date.parse(right.dates[0]?.start_datetime ?? '');
      return leftDate - rightDate;
    });
}

function getPrimarySessionDateTimeLabel(cohort: BookingCohort): string {
  return formatPartDateTimeLabel(cohort.dates[0]?.start_datetime ?? '', 'en');
}

function formatCohortPrice(cohort: BookingCohort): string {
  const normalizedCurrency = cohort.currency.trim();
  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    return new Intl.NumberFormat('en-HK', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    }).format(cohort.price);
  }

  return `${normalizedCurrency}${new Intl.NumberFormat('en-HK', {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(cohort.price)}`;
}

function formatSpacesLeftLabel(count: number): string {
  return bookingContent.spacesLeftLabelTemplate.replace('{count}', String(count));
}

describe('MyBestAuntieBooking section', () => {
  it('auto-opens payment modal when booking_system query targets my-best-auntie booking', async () => {
    window.history.replaceState(
      {},
      '',
      '/en/services/my-best-auntie-training-course?booking_system=my-best-auntie-booking#my-best-auntie-booking',
    );

    render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    expect(
      await screen.findByRole('dialog', {
        name: myBestAuntieModalContent.title,
      }),
    ).toBeInTheDocument();
  });

  it('uses default section shell top spacing classes', () => {
    const { container } = render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const section = container.querySelector('section#my-best-auntie-booking');
    expect(section?.className).not.toContain('pt-0');
    expect(section?.className).not.toContain('sm:pt-[60px]');
    expect(section?.className).toContain('es-section-shell-spacing');
  });

  it('updates date cards by selected age group and keeps cohort date in subtitle-lg style', () => {
    render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const firstAgeOption = bookingContent.ageOptions[0];
    const secondAgeOption = bookingContent.ageOptions[1];
    if (!firstAgeOption || !secondAgeOption) {
      throw new Error('Test content must include age options.');
    }
    const firstAgeCohorts = getCohortsForAge(bookingContent, firstAgeOption.id);
    const secondAgeCohorts = getCohortsForAge(bookingContent, secondAgeOption.id);
    const firstAgeFirstCohort = firstAgeCohorts[0];
    const secondAgeFirstCohort = secondAgeCohorts[0];
    const secondAgeSecondCohort = secondAgeCohorts[1];

    if (!firstAgeFirstCohort || !secondAgeFirstCohort || !secondAgeSecondCohort) {
      throw new Error('Test content must include age and cohort mappings.');
    }

    const formattedFirstCohortDate = formatCohortPreviewLabel(
      getPrimarySessionDateTimeLabel(firstAgeFirstCohort),
    );
    const formattedSecondCohortDate = formatCohortPreviewLabel(
      getPrimarySessionDateTimeLabel(secondAgeFirstCohort),
    );
    const formattedSecondAgeSecondCohortDate = formatCohortPreviewLabel(
      getPrimarySessionDateTimeLabel(secondAgeSecondCohort),
    );
    const firstCohortPriceLabel = formatCohortPrice(firstAgeFirstCohort);
    const nextCohortCard = screen.getByTestId('my-best-auntie-next-cohort-card');
    expect(nextCohortCard.className).toContain('rounded-inner');
    expect(nextCohortCard.className).toContain('border');
    expect(
      screen.getByText(
        formatNextCohortLabel(
          bookingContent.scheduleLabel,
          firstAgeOption.label,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(formattedFirstCohortDate)).toBeInTheDocument();
    expect(screen.getByText(formattedFirstCohortDate).className).toContain(
      'es-type-subtitle-lg',
    );
    expect(within(nextCohortCard).getByText(firstCohortPriceLabel)).toBeInTheDocument();
    const dateSelectorRegion = screen.getByRole('region', {
      name: bookingContent.dateSelectorLabel,
    });
    expect(within(dateSelectorRegion).getAllByRole('button')).toHaveLength(3);

    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(formatCohortValue(firstAgeFirstCohort.cohort, 'en')),
      }).className,
    ).toContain('es-btn--state-active');

    fireEvent.click(
      screen.getByRole('button', {
        name: secondAgeOption.label,
      }),
    );
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_age_selected',
      expect.objectContaining({
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'selector',
      }),
    );

    expect(
      screen.getByText(
        formatNextCohortLabel(
          bookingContent.scheduleLabel,
          secondAgeOption.label,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(formattedSecondCohortDate)).toBeInTheDocument();
    expect(within(dateSelectorRegion).getAllByRole('button')).toHaveLength(
      secondAgeCohorts.length,
    );
    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(formatCohortValue(secondAgeFirstCohort.cohort, 'en')),
      }).className,
    ).toContain('es-btn--state-active');
    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(formatCohortValue(secondAgeSecondCohort.cohort, 'en')),
      }).className,
    ).toContain('es-btn--state-inactive');

    fireEvent.click(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(formatCohortValue(secondAgeSecondCohort.cohort, 'en')),
      }),
    );
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_date_selected',
      expect.objectContaining({
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'selector',
      }),
    );

    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(formatCohortValue(secondAgeSecondCohort.cohort, 'en')),
      }).className,
    ).toContain('es-btn--state-active');
    expect(screen.getByText(formattedSecondCohortDate)).toBeInTheDocument();
    expect(screen.queryByText(formattedSecondAgeSecondCohortDate)).not.toBeInTheDocument();
  });

  it('shows no date cards for age groups without cohorts and disables CTA', () => {
    const contentWithoutThreeToSix = JSON.parse(
      JSON.stringify(bookingContent),
    ) as BookingContent;
    contentWithoutThreeToSix.cohorts = contentWithoutThreeToSix.cohorts.filter((cohort) => {
      return cohort.age_group !== '3-6';
    });

    render(
      <MyBestAuntieBooking
        locale='en'
        content={contentWithoutThreeToSix}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: '3-6',
      }),
    );

    const dateSelectorRegion = screen.getByRole('region', {
      name: contentWithoutThreeToSix.dateSelectorLabel,
    });
    expect(within(dateSelectorRegion).queryAllByRole('button')).toHaveLength(0);
    expect(
      screen.getByRole('button', {
        name: contentWithoutThreeToSix.confirmAndPayLabel,
      }),
    ).toBeDisabled();
    expect(screen.getByText(contentWithoutThreeToSix.noCohortsLabel)).toBeInTheDocument();
    expect(screen.queryByText('HK$9,000')).not.toBeInTheDocument();
  });

  it('removes right-column selector shadows, keeps date cards in two lines, keeps CTA width to copy, and hides date arrows for three dates', () => {
    const { container } = render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const selectorButtons = container.querySelectorAll('button[aria-pressed]');
    expect(selectorButtons.length).toBeGreaterThan(0);
    for (const selectorButton of selectorButtons) {
      expect(selectorButton.getAttribute('style')).toBeNull();
    }

    const ctaButton = screen.getByRole('button', {
      name: bookingContent.confirmAndPayLabel,
    });
    expect(ctaButton.className).not.toContain('w-full');
    expect(ctaButton.className).toContain('es-btn--primary');

    const firstAgeOption = bookingContent.ageOptions[0];
    if (!firstAgeOption) {
      throw new Error('Test content must include first age option.');
    }
    const secondDateOption = getCohortsForAge(
      bookingContent,
      firstAgeOption.id,
    )[1];
    if (!secondDateOption) {
      throw new Error('Test content must include second date option.');
    }
    const secondDateButton = screen.getByRole('button', {
      name: new RegExp(formatCohortValue(secondDateOption.cohort, 'en')),
    });
    expect(secondDateButton.className).toContain('es-btn--selection');
    expect(secondDateButton.className).toContain('es-btn--state-inactive');
    const secondDateCardContent = secondDateButton.querySelector('div.w-full');
    expect(secondDateCardContent).not.toBeNull();
    expect(secondDateCardContent?.className).toContain('flex-col');
    expect(secondDateCardContent?.className).toContain('items-center');
    const dateLine = secondDateCardContent?.firstElementChild;
    const availabilityLine = secondDateCardContent?.lastElementChild;
    expect(dateLine?.className).toContain('justify-center');
    expect(availabilityLine?.className).toContain('text-center');
    expect(dateLine?.textContent).toContain(formatCohortValue(secondDateOption.cohort, 'en'));
    expect(availabilityLine?.textContent).toContain(
      formatSpacesLeftLabel(secondDateOption.spaces_left),
    );

    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll dates right')).not.toBeInTheDocument();
  });

  it('uses one shared date-style selector shell for both age and date cards', () => {
    render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const firstAgeOption = bookingContent.ageOptions[0];
    if (!firstAgeOption) {
      throw new Error('Test content must include first age option.');
    }
    const firstDateOption = getCohortsForAge(
      bookingContent,
      firstAgeOption.id,
    )[0];
    if (!firstDateOption) {
      throw new Error('Test content must include first age and date options.');
    }

    const firstAgeButton = screen.getByRole('button', {
      name: firstAgeOption.label,
    });
    const dateSelectorRegion = screen.getByRole('region', {
      name: bookingContent.dateSelectorLabel,
    });
    const firstDateButton = within(dateSelectorRegion).getByRole('button', {
      name: new RegExp(formatCohortValue(firstDateOption.cohort, 'en')),
    });

    for (const button of [firstAgeButton, firstDateButton]) {
      expect(button.className).toContain('es-my-best-auntie-booking-selector-card');
      expect(button.className).toContain('es-btn--selection');
    }

    expect(firstAgeButton.className).toContain('w-[140px]');
    expect(firstAgeButton.className).toContain('sm:w-[168px]');
    expect(firstAgeButton.className).not.toContain('rounded-lg');
  });

  it('doubles age icon size and uses wider age icon/text spacing', () => {
    render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const firstAgeOption = bookingContent.ageOptions[0];
    if (!firstAgeOption) {
      throw new Error('Test content must include first age option.');
    }
    const firstAgeButton = screen.getByRole('button', {
      name: firstAgeOption.label,
    });
    expect(firstAgeButton.className).toContain('es-btn--selection');
    expect(firstAgeButton.className).toContain('es-btn--state-active');
    const firstAgeIcon = firstAgeButton.querySelector(
      `img[src="${firstAgeOption.iconSrc}"]`,
    );

    expect(firstAgeIcon).not.toBeNull();
    expect(firstAgeIcon).toHaveAttribute('width', '48');
    expect(firstAgeIcon).toHaveAttribute('height', '48');
    expect(firstAgeIcon?.className).toContain('h-12');
    expect(firstAgeIcon?.className).toContain('w-12');

    const iconRowClassName = firstAgeIcon?.closest('div')?.className ?? '';
    expect(iconRowClassName).toContain('sm:gap-10');
    expect(iconRowClassName).toContain('justify-start');
    const ageLabelClassName = firstAgeButton.querySelector('span')?.className ?? '';
    expect(ageLabelClassName).toContain('text-lg');
  });

  it('shows edge-overlapped arrows only when more dates are available to scroll', () => {
    const extendedBookingContent = JSON.parse(
      JSON.stringify(bookingContent),
    ) as BookingContent;

    extendedBookingContent.cohorts.push(
      {
        id: 'my-best-auntie-0-1-08-26',
        age_group: '0-1',
        title: 'My Best Auntie Training Course 0-1',
        description: 'TBD',
        cohort: '08-26',
        spaces_total: 24,
        spaces_left: 8,
        is_fully_booked: false,
        price: 9000,
        currency: 'HKD',
        location: 'physical',
        tags: [],
        categories: ['Training Course'],
        location_name: 'Goldwin Heights, 2 Seymour Road, Mid-Levels, Hong Kong',
        location_address: 'Goldwin Heights, 2 Seymour Road, Mid-Levels, Hong Kong',
        location_url:
          'https://www.google.com/maps/dir/?api=1&destination=2+Seymour+Road,+Mid-Levels,+Hong+Kong',
        dates: [
          {
            id: 'part-1',
            start_datetime: '2026-08-09T12:00:00Z',
            end_datetime: '2026-08-09T14:00:00Z',
          },
          {
            id: 'part-2',
            start_datetime: '2026-08-16T12:00:00Z',
            end_datetime: '2026-08-16T14:00:00Z',
          },
          {
            id: 'part-3',
            start_datetime: '2026-08-23T12:00:00Z',
            end_datetime: '2026-08-23T14:00:00Z',
          },
        ],
      },
      {
        id: 'my-best-auntie-0-1-09-26',
        age_group: '0-1',
        title: 'My Best Auntie Training Course 0-1',
        description: 'TBD',
        cohort: '09-26',
        spaces_total: 24,
        spaces_left: 4,
        is_fully_booked: false,
        price: 9000,
        currency: 'HKD',
        location: 'physical',
        tags: [],
        categories: ['Training Course'],
        location_name: 'Goldwin Heights, 2 Seymour Road, Mid-Levels, Hong Kong',
        location_address: 'Goldwin Heights, 2 Seymour Road, Mid-Levels, Hong Kong',
        location_url:
          'https://www.google.com/maps/dir/?api=1&destination=2+Seymour+Road,+Mid-Levels,+Hong+Kong',
        dates: [
          {
            id: 'part-1',
            start_datetime: '2026-09-09T12:00:00Z',
            end_datetime: '2026-09-09T14:00:00Z',
          },
          {
            id: 'part-2',
            start_datetime: '2026-09-16T12:00:00Z',
            end_datetime: '2026-09-16T14:00:00Z',
          },
          {
            id: 'part-3',
            start_datetime: '2026-09-23T12:00:00Z',
            end_datetime: '2026-09-23T14:00:00Z',
          },
        ],
      },
    );

    render(
      <MyBestAuntieBooking
        locale='en'
        content={extendedBookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const carousel = screen.getByTestId('my-best-auntie-booking-date-carousel');
    let scrollLeftValue = 0;
    const maxScrollLeft = 416;

    Object.defineProperty(carousel, 'clientWidth', {
      configurable: true,
      get: () => 520,
    });
    Object.defineProperty(carousel, 'scrollWidth', {
      configurable: true,
      get: () => 936,
    });
    Object.defineProperty(carousel, 'scrollLeft', {
      configurable: true,
      get: () => scrollLeftValue,
      set: (value: number) => {
        scrollLeftValue = value;
      },
    });
    Object.defineProperty(carousel, 'scrollBy', {
      configurable: true,
      value: ({ left }: { left: number }) => {
        scrollLeftValue = Math.max(
          0,
          Math.min(maxScrollLeft, scrollLeftValue + left),
        );
        carousel.dispatchEvent(new Event('scroll'));
      },
    });

    fireEvent(window, new Event('resize'));

    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    const rightArrow = screen.getByLabelText('Scroll dates right');
    expect(rightArrow.className).toContain('absolute');
    expect(rightArrow.className).toContain('hidden');
    expect(rightArrow.className).toContain('md:flex');
    expect(rightArrow.className).toContain('right-0');
    expect(rightArrow.className).toContain('translate-x-1/2');

    fireEvent.click(rightArrow);

    const leftArrow = screen.getByLabelText('Scroll dates left');
    expect(leftArrow.className).toContain('absolute');
    expect(leftArrow.className).toContain('hidden');
    expect(leftArrow.className).toContain('md:flex');
    expect(leftArrow.className).toContain('left-0');
    expect(leftArrow.className).toContain('-translate-x-1/2');
    expect(screen.queryByLabelText('Scroll dates right')).not.toBeInTheDocument();

    fireEvent.click(leftArrow);
    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Scroll dates right')).toBeInTheDocument();
  });

  it('tracks confirm-and-pay click and modal open events', async () => {
    render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: bookingContent.confirmAndPayLabel,
      }),
    );

    expect(await screen.findByRole('dialog', {
      name: myBestAuntieModalContent.title,
    })).toBeInTheDocument();
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_confirm_pay_click',
      expect.objectContaining({
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'booking_section',
      }),
    );
    expect(mockedTrackAnalyticsEvent).toHaveBeenCalledWith(
      'booking_modal_open',
      expect.objectContaining({
        sectionId: 'my-best-auntie-booking',
        ctaLocation: 'booking_section',
      }),
    );
  });

  it('renders private programme CTA as outline link with dedicated WhatsApp message', () => {
    render(
      <MyBestAuntieBooking
        locale='en'
        content={bookingContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
        privateProgrammeWhatsappHref={privateProgrammeWhatsappHref}
      />,
    );

    const privateProgrammeCta = screen.getByRole('link', {
      name: bookingContent.privateProgrammeCtaLabel,
    });
    expect(privateProgrammeCta.className).toContain('es-btn--primary');
    expect(privateProgrammeCta.className).toContain('es-btn--outline');
    expect(privateProgrammeCta).toHaveAttribute('href', privateProgrammeWhatsappHref);
  });

  it('renders sold-out date cards as disabled with stamp and skips them for initial selection', () => {
    const soldOutContent = JSON.parse(
      JSON.stringify(bookingContent),
    ) as BookingContent;

    const soldOutCohort = soldOutContent.cohorts.find(
      (cohort) => cohort.age_group === '0-1',
    );
    expect(soldOutCohort).toBeDefined();
    soldOutCohort!.is_fully_booked = true;
    soldOutCohort!.spaces_left = 0;

    render(
      <MyBestAuntieBooking
        locale='en'
        content={soldOutContent}
        modalContent={myBestAuntieModalContent}
        bookingModalContent={bookingModalContent}
      />,
    );

    const dateSelectorRegion = screen.getByRole('region', {
      name: soldOutContent.dateSelectorLabel,
    });

    const soldOutButton = within(dateSelectorRegion).getByRole('button', {
      name: new RegExp(formatCohortValue(soldOutCohort!.cohort, 'en')),
    });
    expect(soldOutButton.getAttribute('aria-disabled')).toBe('true');
    expect(soldOutButton.className).toContain('pointer-events-none');

    const soldOutCardContent = soldOutButton.querySelector('div.flex.w-full');
    expect(soldOutCardContent?.className).toContain('opacity-40');

    const stampText = within(soldOutButton).getByText(soldOutContent.soldOutStampLabel);
    expect(stampText).toBeInTheDocument();
    expect(stampText.className).toContain('es-cohort-sold-out-stamp-text');

    const firstAvailableCohort = getCohortsForAge(soldOutContent, '0-1').find(
      (cohort) => !cohort.is_fully_booked,
    );
    expect(firstAvailableCohort).toBeDefined();
    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(formatCohortValue(firstAvailableCohort!.cohort, 'en')),
      }).className,
    ).toContain('es-btn--state-active');
  });
});
