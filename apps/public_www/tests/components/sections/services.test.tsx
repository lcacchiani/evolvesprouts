/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Services } from '@/components/sections/services';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('Services', () => {
  it('falls back to default copy and metadata when section content is sparse and renders three service link cards', () => {
    const sparseContent = {
      ...enContent.services,
      eyebrow: '',
      title: '',
      items: [],
    };

    render(<Services content={sparseContent} />);

    expect(
      screen.getByRole('heading', { name: enContent.services.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(enContent.services.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to My Best Auntie Programme' }),
    ).toHaveAttribute('href', '/services/my-best-auntie-training-course');
    expect(
      screen.getByRole('link', { name: 'Go to Family Consultations' }),
    ).toHaveAttribute('href', '/services/consultations');
    expect(
      screen.getByRole('link', { name: 'Go to Free Guides & Resources' }),
    ).toHaveAttribute('href', '/services/free-guides-and-resources');

    const cardsGrid = screen
      .getByRole('link', { name: 'Go to My Best Auntie Programme' })
      .closest('ul');
    expect(cardsGrid).not.toBeNull();
    expect(cardsGrid?.parentElement?.className).toContain('mt-12');
    expect(cardsGrid?.parentElement?.className).toContain('sm:mt-14');
    expect(cardsGrid?.parentElement?.className).toContain('xl:mt-16');

    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(3);
    expect(document.querySelectorAll('.es-service-card--green').length).toBeGreaterThan(
      0,
    );
    expect(document.querySelectorAll('.es-service-card--gold')).toHaveLength(0);

    const firstCard = document.querySelector(
      '[data-service-card-id="my-best-auntie"]',
    );
    expect(firstCard).not.toBeNull();
    const firstIllustration = firstCard?.querySelector('div.z-0');
    expect(firstIllustration?.className).toContain('translate-x-[30px]');

    const secondCard = document.querySelector(
      '[data-service-card-id="family-consultations"]',
    );
    const secondIllustration = secondCard?.querySelector('div.z-0');
    expect(secondIllustration?.className).toContain('translate-y-[15px]');
    expect(secondIllustration?.className).not.toContain('translate-x-[30px]');
  });
});
