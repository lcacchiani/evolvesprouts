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

    const cards = screen.getAllByRole('button');
    expect(cards).toHaveLength(3);
    expect(document.querySelectorAll('.es-service-card--green').length).toBeGreaterThan(
      0,
    );
    expect(document.querySelectorAll('.es-service-card--gold')).toHaveLength(0);
  });
});
