/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FreeIntroSession } from '@/components/sections/free-intro-session';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    fill: _fill,
    priority: _priority,
    ...props
  }: {
    alt?: string;
    fill?: boolean;
    priority?: boolean;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

describe('FreeIntroSession section', () => {
  it('renders heading, paragraph, and CTA href from navbar link', () => {
    const ctaHref = 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr';

    render(<FreeIntroSession content={enContent.freeIntroSession} ctaHref={ctaHref} />);

    expect(
      screen.getByRole('heading', { level: 2, name: enContent.freeIntroSession.heading }),
    ).toBeInTheDocument();
    expect(screen.getByText(enContent.freeIntroSession.supportParagraph)).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: enContent.freeIntroSession.ctaLabel });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', ctaHref);
  });
});
