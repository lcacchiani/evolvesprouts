/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('MyBestAuntieBooking section', () => {
  it('renders next cohort as a rounded card and keeps it fixed to the first locale booking entry', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const firstMonthId = enContent.myBestAuntieBooking.paymentModal.monthOptions[0]?.id;
    const firstCohortDate =
      firstMonthId
        ? enContent.myBestAuntieBooking.paymentModal.parts[0]?.dateByMonth[firstMonthId]
        : undefined;
    const secondMonthId = enContent.myBestAuntieBooking.paymentModal.monthOptions[1]?.id;
    const secondCohortDate =
      secondMonthId
        ? enContent.myBestAuntieBooking.paymentModal.parts[0]?.dateByMonth[secondMonthId]
        : undefined;
    const secondDateOption = enContent.myBestAuntieBooking.dateOptions[1];

    if (!firstCohortDate || !secondDateOption) {
      throw new Error('Test content must include first and second cohort data.');
    }

    const formattedFirstCohortDate = formatCohortPreviewLabel(firstCohortDate);
    const nextCohortCard = screen.getByTestId('my-best-auntie-next-cohort-card');
    expect(nextCohortCard.className).toContain('rounded-input');
    expect(nextCohortCard.className).toContain('border');
    expect(screen.getByText(enContent.myBestAuntieBooking.scheduleLabel)).toBeInTheDocument();
    expect(screen.getByText(formattedFirstCohortDate)).toBeInTheDocument();
    expect(
      screen.queryByText(enContent.myBestAuntieBooking.scheduleTime),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(secondDateOption.label),
      }),
    );

    expect(screen.getByText(formattedFirstCohortDate)).toBeInTheDocument();
    if (secondCohortDate) {
      expect(
        screen.queryByText(formatCohortPreviewLabel(secondCohortDate)),
      ).not.toBeInTheDocument();
    }
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

    const secondDateOption = enContent.myBestAuntieBooking.dateOptions[1];
    if (!secondDateOption) {
      throw new Error('Test content must include second date option.');
    }
    const secondDateButton = screen.getByRole('button', {
      name: new RegExp(secondDateOption.label),
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
    expect(dateLine?.textContent).toContain(secondDateOption.label);
    expect(availabilityLine?.textContent).toContain(secondDateOption.availabilityLabel);

    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll dates right')).not.toBeInTheDocument();
  });

  it('doubles age icon size and uses wider age icon/text spacing', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const firstAgeOption = enContent.myBestAuntieBooking.ageOptions[0];
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
    ) as typeof enContent.myBestAuntieBooking;

    (extendedBookingContent as any).dateOptions.push(
      {
        id: 'jul-2026',
        label: 'Jul, 2026',
        availabilityLabel: '8 Spots Left!',
      },
      {
        id: 'aug-2026',
        label: 'Aug, 2026',
        availabilityLabel: '4 Spots Left!',
      },
    );
    (extendedBookingContent as any).paymentModal.monthOptions.push(
      { id: 'jul-2026', label: 'Jul, 2026' },
      { id: 'aug-2026', label: 'Aug, 2026' },
    );
    for (const part of (extendedBookingContent as any).paymentModal.parts) {
      part.dateByMonth['jul-2026'] = part.dateByMonth['jun-2026'];
      part.dateByMonth['aug-2026'] = part.dateByMonth['jun-2026'];
    }

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
