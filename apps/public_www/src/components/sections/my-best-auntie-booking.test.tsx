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

describe('MyBestAuntieBooking section', () => {
  it('keeps next cohort fixed to the first locale booking entry', () => {
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

    expect(screen.getByText(firstCohortDate)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(secondDateOption.label),
      }),
    );

    expect(screen.getByText(firstCohortDate)).toBeInTheDocument();
    if (secondCohortDate) {
      expect(screen.queryByText(secondCohortDate)).not.toBeInTheDocument();
    }
  });

  it('removes right-column selector shadows, keeps CTA width to copy, and hides date arrows for three dates', () => {
    const { container } = render(
      <MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />,
    );

    const selectorButtons = container.querySelectorAll('button[aria-pressed]');
    expect(selectorButtons.length).toBeGreaterThan(0);
    for (const selectorButton of selectorButtons) {
      const styleAttribute = selectorButton.getAttribute('style') ?? '';
      expect(styleAttribute).not.toContain('box-shadow');
    }

    const ctaButton = screen.getByRole('button', {
      name: enContent.myBestAuntieBooking.confirmAndPayLabel,
    });
    expect(ctaButton.className).not.toContain('w-full');
    expect(screen.queryByLabelText('Scroll dates left')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Scroll dates right')).not.toBeInTheDocument();
  });

  it('doubles age icon size while keeping original icon-text gap', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const firstAgeOption = enContent.myBestAuntieBooking.ageOptions[0];
    const firstAgeButton = screen.getByRole('button', {
      name: firstAgeOption.label,
    });
    const firstAgeIcon = firstAgeButton.querySelector(
      `img[src="${firstAgeOption.iconSrc}"]`,
    );

    expect(firstAgeIcon).not.toBeNull();
    expect(firstAgeIcon).toHaveAttribute('width', '48');
    expect(firstAgeIcon).toHaveAttribute('height', '48');
    expect(firstAgeIcon?.className).toContain('h-12');
    expect(firstAgeIcon?.className).toContain('w-12');

    const iconRowClassName = firstAgeIcon?.closest('div')?.className ?? '';
    expect(iconRowClassName).toContain('gap-3');
    expect(iconRowClassName).toContain('justify-start');
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
