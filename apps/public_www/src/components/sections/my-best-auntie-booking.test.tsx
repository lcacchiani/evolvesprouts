/* eslint-disable @next/next/no-img-element */
import { render, screen, within } from '@testing-library/react';
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
  it('renders next cohort before title and description', () => {
    render(<MyBestAuntieBooking locale='en' content={enContent.myBestAuntieBooking} />);

    const section = screen.getByRole('region', {
      name: enContent.myBestAuntieBooking.title,
    });
    const scheduleLabel = within(section).getByText(
      enContent.myBestAuntieBooking.scheduleLabel,
    );
    const title = within(section).getByRole('heading', {
      level: 1,
      name: enContent.myBestAuntieBooking.title,
    });

    const followsTitle =
      scheduleLabel.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(followsTitle).toBeTruthy();
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
