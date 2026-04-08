import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsultationsFocusDetails } from '@/components/sections/consultations/consultations-focus-details';
import enContent from '@/content/en.json';

describe('ConsultationsFocusDetails section', () => {
  const focusDetails = enContent.consultations.focusDetails;

  it('uses muted section background overlay classes', () => {
    render(<ConsultationsFocusDetails content={focusDetails} />);

    const section = screen.getByRole('region', {
      name: focusDetails.title,
    });

    expect(section.className).toContain('es-section-bg-overlay');
    expect(section.className).toContain('es-consultations-focus-details-section');
  });

  it('left-aligns the header title', () => {
    render(<ConsultationsFocusDetails content={focusDetails} />);

    const title = screen.getByRole('heading', {
      level: 2,
      name: focusDetails.title,
    });
    const titleWrapperClassName = title.parentElement?.className ?? '';

    expect(titleWrapperClassName).toContain('text-left');
    expect(titleWrapperClassName).not.toContain('text-center');
  });

  it('keeps carousel controls in the header row (hidden on mobile, flex on md+)', () => {
    render(<ConsultationsFocusDetails content={focusDetails} />);

    const header = screen.getByTestId('consultations-focus-details-header');
    const controls = screen.getByTestId('consultations-focus-details-controls');

    expect(header.className).toContain('md:flex-row');
    expect(header.className).toContain('md:items-end');
    expect(controls.parentElement).toBe(header);
    expect(controls.className).toContain('hidden');
    expect(controls.className).toContain('md:flex');
  });

  it('uses fixed 3-up desktop card sizing with start snap', () => {
    render(<ConsultationsFocusDetails content={focusDetails} />);

    const firstAreaTitle = focusDetails.areas[0]?.title;
    expect(firstAreaTitle).toBeDefined();

    const firstCardHeading = screen.getByRole('heading', {
      level: 3,
      name: firstAreaTitle,
    });
    const firstCardListItem = firstCardHeading.closest('li');

    expect(firstCardListItem).not.toBeNull();
    expect(firstCardListItem?.className).toContain('md:w-[calc((100%-3rem)/3)]');
    expect(firstCardListItem?.className).toContain('md:snap-start');
  });

  it('renders white carousel cards with title and tier content', () => {
    render(<ConsultationsFocusDetails content={focusDetails} />);

    const firstArea = focusDetails.areas[0];
    expect(firstArea).toBeDefined();

    const cardHeading = screen.getByRole('heading', {
      level: 3,
      name: firstArea.title,
    });
    const cardArticle = cardHeading.closest('article');

    expect(cardArticle?.className).toContain('es-consultations-focus-details-card');
    expect(cardHeading.className).toContain('es-consultations-focus-details-card-title');

    const card = within(cardArticle as HTMLElement);
    expect(card.getByText(focusDetails.essentialsLabel)).toBeInTheDocument();
    expect(card.getByText(focusDetails.deepDiveLabel)).toBeInTheDocument();
    expect(card.getByText(firstArea.essentials)).toBeInTheDocument();
    expect(card.getByText(firstArea.deepDive)).toBeInTheDocument();
  });

  it('renders focus area icons from content and cycles green-blue-red tones', () => {
    const { container } = render(<ConsultationsFocusDetails content={focusDetails} />);

    const focusIcons = container.querySelectorAll(
      '[data-testid="consultations-focus-details-focus-icon"]',
    );
    expect(focusIcons).toHaveLength(focusDetails.areas.length);

    focusDetails.areas.forEach((area, index) => {
      const icon = focusIcons[index];
      expect(icon).toHaveAttribute('src', area.iconSrc);
    });

    const expectedToneClasses = [
      'es-consultations-focus-details-focus-icon-tone--green',
      'es-consultations-focus-details-focus-icon-tone--blue',
      'es-consultations-focus-details-focus-icon-tone--red',
    ];

    focusIcons.forEach((icon, index) => {
      expect(icon.className).toContain(expectedToneClasses[index]);
    });
  });

  it('renders tier label icons from shared SVG paths', () => {
    const { container } = render(<ConsultationsFocusDetails content={focusDetails} />);

    const tierImgs = container.querySelectorAll(
      `img[src="${focusDetails.essentialsIconSrc}"], img[src="${focusDetails.deepDiveIconSrc}"]`,
    );
    expect(tierImgs.length).toBeGreaterThanOrEqual(
      focusDetails.areas.length * 2,
    );
  });
});
