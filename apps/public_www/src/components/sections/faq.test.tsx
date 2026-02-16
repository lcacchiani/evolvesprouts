import { render, screen, within } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Faq } from '@/components/sections/faq';
import enContent from '@/content/en.json';

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

describe('Faq section', () => {
  it('uses the testimonials background image and overlay properties', () => {
    const { container } = render(<Faq content={enContent.faq} />);

    const section = container.querySelector('section[data-figma-node="faq"]');
    expect(
      section,
    ).not.toBeNull();
    expect(section?.className).toContain('es-section-bg-overlay');
    expect(section?.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(section?.style.getPropertyValue('--es-section-bg-image')).toContain(
      '/images/evolvesprouts-logo.svg',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-position')).toBe(
      'center -150px',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-size')).toBe(
      '900px auto',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-filter')).toBe(
      'sepia(1) opacity(7%) hue-rotate(-50deg) saturate(250%)',
    );
    expect(section?.style.getPropertyValue('--es-section-bg-mask-image')).toBe(
      'linear-gradient(to bottom, black 18%, transparent 20%)',
    );
    expect(section?.querySelector('div.relative.z-10')).not.toBeNull();
  });

  it('renders the fallback prompt as a blue card with contact CTA', () => {
    render(<Faq content={enContent.faq} />);

    const fallbackQuestion = enContent.faq.questions.find(
      (item) => item.question === 'Have not found what you need?',
    );
    if (!fallbackQuestion) {
      throw new Error('Expected fallback FAQ prompt in content fixture');
    }

    const questionHeading = screen.getByRole('heading', {
      level: 3,
      name: fallbackQuestion.question,
    });
    expect(questionHeading.getAttribute('style')).toContain(
      'color: var(--figma-colors-desktop, #FFFFFF)',
    );

    const card = questionHeading.closest('article');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('style')).toContain(
      'background-color: var(--figma-colors-frame-2147235242, #174879)',
    );
    expect(card?.querySelector('div[class*="border-l"]')).toBeNull();

    const answer = screen.getByText(fallbackQuestion.answer);
    expect(answer.getAttribute('style')).toContain(
      'color: var(--figma-colors-desktop, #FFFFFF)',
    );

    const contactCta = within(card as HTMLElement).getByRole('link', {
      name: 'Contact Us',
    });
    expect(contactCta).toHaveAttribute('href', '/contact-us');
    expect(contactCta.className).toContain('es-cta-primary');
  });

  it('uses navbar pill colors for category buttons and a grey search input', () => {
    render(<Faq content={enContent.faq} />);

    const firstLabel = enContent.faq.labels[0];
    const secondLabel = enContent.faq.labels[1];
    if (!firstLabel || !secondLabel) {
      throw new Error('Expected at least two FAQ labels in content fixture');
    }

    const activeLabelButton = screen.getByRole('button', {
      name: firstLabel.label,
    });
    const inactiveLabelButton = screen.getByRole('button', {
      name: secondLabel.label,
    });

    expect(activeLabelButton.className).toContain('es-nav-pill');
    expect(inactiveLabelButton.className).toContain('es-nav-pill');
    expect(activeLabelButton).toHaveStyle({
      backgroundColor: 'rgb(242, 169, 117)',
    });
    expect(inactiveLabelButton).toHaveStyle({
      backgroundColor: 'rgb(246, 222, 205)',
    });
    expect(activeLabelButton.getAttribute('style')).toContain(
      'var(--figma-colors-join-our-sprouts-squad-community, #333333)',
    );

    const searchInput = screen.getByRole('textbox', {
      name: enContent.faq.searchPlaceholder,
    });
    expect(searchInput.className).toContain('bg-[#F2F2F2]');
  });
});
