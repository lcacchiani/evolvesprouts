/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie-booking';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

function formatCohortPreviewLabel(value: string): string {
  const firstDateSegment = value.split(/\s+-\s+/)[0]?.trim() ?? value.trim();

  return firstDateSegment.replace(/\s+(am|pm)$/i, '$1');
}

function formatNextCohortLabel(scheduleLabel: string, ageGroupLabel: string): string {
  return `${scheduleLabel} for ${ageGroupLabel} age group`;
}

type BookingContent = typeof enContent.myBestAuntieBooking;
type BookingCohort = BookingContent['cohorts'][number];

function getCohortsForAge(content: BookingContent, ageGroupId: string): BookingCohort[] {
  return content.cohorts
    .filter((cohort) => cohort.ageGroupId === ageGroupId)
    .sort((left, right) => {
      const leftDate = Date.parse(`${left.sessions[0]?.isoDate ?? ''}T00:00:00Z`);
      const rightDate = Date.parse(`${right.sessions[0]?.isoDate ?? ''}T00:00:00Z`);
      return leftDate - rightDate;
    });
}

function getPrimarySessionDateTimeLabel(cohort: BookingCohort): string {
  return cohort.sessions[0]?.dateTimeLabel ?? '';
}

function formatCohortPrice(cohort: BookingCohort): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: cohort.priceCurrency,
    maximumFractionDigits: 0,
  }).format(cohort.price);
}

describe('MyBestAuntieBooking section', () => {
  it('updates date cards by selected age group and keeps cohort date in subtitle-lg style', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const firstAgeOption = enContent.myBestAuntieBooking.ageOptions[0];
    const secondAgeOption = enContent.myBestAuntieBooking.ageOptions[1];
    if (!firstAgeOption || !secondAgeOption) {
      throw new Error('Test content must include age options.');
    }
    const firstAgeCohorts = getCohortsForAge(enContent.myBestAuntieBooking, firstAgeOption.id);
    const secondAgeCohorts = getCohortsForAge(enContent.myBestAuntieBooking, secondAgeOption.id);
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
          enContent.myBestAuntieBooking.scheduleLabel,
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
      name: enContent.myBestAuntieBooking.dateSelectorLabel,
    });
    expect(within(dateSelectorRegion).getAllByRole('button')).toHaveLength(3);

    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(firstAgeFirstCohort.dateLabel),
      }).className,
    ).toContain('es-btn--state-active');

    fireEvent.click(
      screen.getByRole('button', {
        name: secondAgeOption.label,
      }),
    );

    expect(
      screen.getByText(
        formatNextCohortLabel(
          enContent.myBestAuntieBooking.scheduleLabel,
          secondAgeOption.label,
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(formattedSecondCohortDate)).toBeInTheDocument();
    expect(within(dateSelectorRegion).getAllByRole('button')).toHaveLength(2);
    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(secondAgeFirstCohort.dateLabel),
      }).className,
    ).toContain('es-btn--state-active');
    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(secondAgeSecondCohort.dateLabel),
      }).className,
    ).toContain('es-btn--state-inactive');

    fireEvent.click(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(secondAgeSecondCohort.dateLabel),
      }),
    );

    expect(
      within(dateSelectorRegion).getByRole('button', {
        name: new RegExp(secondAgeSecondCohort.dateLabel),
      }).className,
    ).toContain('es-btn--state-active');
    expect(screen.getByText(formattedSecondCohortDate)).toBeInTheDocument();
    expect(screen.queryByText(formattedSecondAgeSecondCohortDate)).not.toBeInTheDocument();
  });

  it('shows no date cards for age groups without cohorts and disables CTA', () => {
    const contentWithoutThreeToSix = JSON.parse(
      JSON.stringify(enContent.myBestAuntieBooking),
    ) as BookingContent;
    contentWithoutThreeToSix.cohorts = contentWithoutThreeToSix.cohorts.filter((cohort) => {
      return cohort.ageGroupId !== '3-6';
    });

    render(<MyBestAuntieBooking locale='en' content={contentWithoutThreeToSix} />);

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
      <MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />,
    );

    const selectorButtons = container.querySelectorAll('button[aria-pressed]');
    expect(selectorButtons.length).toBeGreaterThan(0);
    for (const selectorButton of selectorButtons) {
      expect(selectorButton.getAttribute('style')).toBeNull();
    }

    const ctaButton = screen.getByRole('button', {
      name: enContent.myBestAuntieBooking.confirmAndPayLabel,
    });
    expect(ctaButton.className).not.toContain('w-full');
    expect(ctaButton.className).toContain('es-btn--primary');

    const firstAgeOption = enContent.myBestAuntieBooking.ageOptions[0];
    if (!firstAgeOption) {
      throw new Error('Test content must include first age option.');
    }
    const secondDateOption = getCohortsForAge(
      enContent.myBestAuntieBooking,
      firstAgeOption.id,
    )[1];
    if (!secondDateOption) {
      throw new Error('Test content must include second date option.');
    }
    const secondDateButton = screen.getByRole('button', {
      name: new RegExp(secondDateOption.dateLabel),
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
    expect(dateLine?.textContent).toContain(secondDateOption.dateLabel);
    expect(availabilityLine?.textContent).toContain(secondDateOption.spacesLeftText);

    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll dates right')).not.toBeInTheDocument();
  });

  it('uses one shared date-style selector shell for both age and date cards', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const firstAgeOption = enContent.myBestAuntieBooking.ageOptions[0];
    if (!firstAgeOption) {
      throw new Error('Test content must include first age option.');
    }
    const firstDateOption = getCohortsForAge(
      enContent.myBestAuntieBooking,
      firstAgeOption.id,
    )[0];
    if (!firstDateOption) {
      throw new Error('Test content must include first age and date options.');
    }

    const firstAgeButton = screen.getByRole('button', {
      name: firstAgeOption.label,
    });
    const dateSelectorRegion = screen.getByRole('region', {
      name: enContent.myBestAuntieBooking.dateSelectorLabel,
    });
    const firstDateButton = within(dateSelectorRegion).getByRole('button', {
      name: new RegExp(firstDateOption.dateLabel),
    });

    for (const button of [firstAgeButton, firstDateButton]) {
      expect(button.className).toContain('es-my-best-auntie-booking-selector-card');
      expect(button.className).toContain('es-btn--selection');
    }

    expect(firstAgeButton.className).not.toContain('w-[');
    expect(firstAgeButton.className).not.toContain('rounded-lg');
  });

  it('doubles age icon size and uses wider age icon/text spacing', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const firstAgeOption = enContent.myBestAuntieBooking.ageOptions[0];
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
    expect(iconRowClassName).toContain('gap-10');
    expect(iconRowClassName).toContain('justify-start');
    const ageLabelClassName = firstAgeButton.querySelector('span')?.className ?? '';
    expect(ageLabelClassName).toContain('text-lg');
  });

  it('shows edge-overlapped arrows only when more dates are available to scroll', () => {
    const extendedBookingContent = JSON.parse(
      JSON.stringify(enContent.myBestAuntieBooking),
    ) as BookingContent;

    extendedBookingContent.cohorts.push(
      {
        id: '0-1-aug-2026',
        ageGroupId: '0-1',
        dateLabel: 'Aug, 2026',
        spacesTotal: 24,
        spacesLeftText: '8 spots left',
        price: 9000,
        priceCurrency: 'HKD',
        venue: {
          name: 'Goldwin Heights',
          address: '2 Seymour Road, Mid-Levels, Hong Kong',
          directionHref:
            'https://www.google.com/maps/dir/?api=1&destination=2+Seymour+Road,+Mid-Levels,+Hong+Kong',
        },
        sessions: [
          {
            id: 'part-1',
            dateTimeLabel: 'Aug 09 @ 12:00 pm - 2:00 pm',
            isoDate: '2026-08-09',
            description: 'Starting with a parent call, followed by a 1:1 session.',
          },
          {
            id: 'part-2',
            dateTimeLabel: 'Aug 16 @ 12:00 pm - 2:00 pm',
            isoDate: '2026-08-16',
            description: 'Hands-on role play for practical routines and communication.',
          },
          {
            id: 'part-3',
            dateTimeLabel: 'Aug 23 @ 12:00 pm - 2:00 pm',
            isoDate: '2026-08-23',
            description: 'Action plan check-in to apply strategies at home with confidence.',
          },
        ],
      },
      {
        id: '0-1-sep-2026',
        ageGroupId: '0-1',
        dateLabel: 'Sep, 2026',
        spacesTotal: 24,
        spacesLeftText: '4 spots left',
        price: 9000,
        priceCurrency: 'HKD',
        venue: {
          name: 'Goldwin Heights',
          address: '2 Seymour Road, Mid-Levels, Hong Kong',
          directionHref:
            'https://www.google.com/maps/dir/?api=1&destination=2+Seymour+Road,+Mid-Levels,+Hong+Kong',
        },
        sessions: [
          {
            id: 'part-1',
            dateTimeLabel: 'Sep 09 @ 12:00 pm - 2:00 pm',
            isoDate: '2026-09-09',
            description: 'Starting with a parent call, followed by a 1:1 session.',
          },
          {
            id: 'part-2',
            dateTimeLabel: 'Sep 16 @ 12:00 pm - 2:00 pm',
            isoDate: '2026-09-16',
            description: 'Hands-on role play for practical routines and communication.',
          },
          {
            id: 'part-3',
            dateTimeLabel: 'Sep 23 @ 12:00 pm - 2:00 pm',
            isoDate: '2026-09-23',
            description: 'Action plan check-in to apply strategies at home with confidence.',
          },
        ],
      },
    );

    render(<MyBestAuntieBooking locale='en' content={extendedBookingContent} />);

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
    expect(rightArrow.className).toContain('right-0');
    expect(rightArrow.className).toContain('translate-x-1/2');

    fireEvent.click(rightArrow);

    const leftArrow = screen.getByLabelText('Scroll dates left');
    expect(leftArrow.className).toContain('absolute');
    expect(leftArrow.className).toContain('left-0');
    expect(leftArrow.className).toContain('-translate-x-1/2');
    expect(screen.queryByLabelText('Scroll dates right')).not.toBeInTheDocument();

    fireEvent.click(leftArrow);
    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Scroll dates right')).toBeInTheDocument();
  });
});
