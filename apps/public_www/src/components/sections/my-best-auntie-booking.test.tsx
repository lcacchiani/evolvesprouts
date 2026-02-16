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

  it('removes right-column selector shadows and keeps CTA width to copy', () => {
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
  });

  it('doubles age icon size and halves icon-text gap', () => {
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
    expect(iconRowClassName).toContain('gap-1.5');
    expect(iconRowClassName).toContain('justify-start');
    expect(iconRowClassName).not.toContain('justify-between');
  });
});
