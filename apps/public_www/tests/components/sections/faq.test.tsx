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

vi.mock('next/navigation', () => ({
  usePathname: () => '/zh-CN/about-us',
}));

describe('Faq section', () => {
  it('uses the migrated FAQ section background class', () => {
    const { container } = render(<Faq content={enContent.faq} />);

    const section = container.querySelector('section[data-figma-node="faq"]');
    expect(
      section,
    ).not.toBeNull();
    expect(section?.className).toContain('es-section-bg-overlay');
    expect(section?.className).toContain('es-faq-section');
    expect(section?.querySelector('div.es-layout-container')).not.toBeNull();
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
    expect(questionHeading.className).toContain('es-faq-contact-question');

    const card = questionHeading.closest('article');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('es-faq-contact-card');
    expect(card?.querySelector('div[class*="border-l"]')).toBeNull();

    const answer = screen.getByText(fallbackQuestion.answer);
    expect(answer.className).toContain('es-faq-contact-answer');

    const contactCta = within(card as HTMLElement).getByRole('link', {
      name: 'Contact Us',
    });
    expect(contactCta).toHaveAttribute('href', '/zh-CN/contact-us');
    expect(contactCta.className).toContain('es-btn');
    expect(contactCta.className).toContain('es-btn--primary');
  });

  it('uses shared button states for category buttons and a grey search input', () => {
    const { container } = render(<Faq content={enContent.faq} />);

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

    expect(activeLabelButton.className).toContain('es-btn');
    expect(activeLabelButton.className).toContain('es-btn--pill');
    expect(activeLabelButton.className).toContain('es-btn--state-active');
    expect(inactiveLabelButton.className).toContain('es-btn');
    expect(inactiveLabelButton.className).toContain('es-btn--pill');
    expect(inactiveLabelButton.className).toContain('es-btn--state-inactive');

    const searchInput = screen.getByRole('textbox', {
      name: enContent.faq.searchPlaceholder,
    });
    expect(searchInput.className).toContain('es-bg-surface-neutral');

    const searchWrapper = container.querySelector('div.es-layout-container.mt-8');
    expect(searchWrapper?.className).toContain('es-bg-surface-neutral');
  });
});
