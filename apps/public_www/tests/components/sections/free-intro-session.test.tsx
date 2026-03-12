/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { getContent } from '@/content';

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
  it('renders heading, paragraph, and CTA href from section content', () => {
    const content = getContent('en').freeIntroSession;

    render(<FreeIntroSession content={content} />);

    expect(
      screen.getByRole('heading', { level: 2, name: content.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(content.description)).toBeInTheDocument();

    const cta = screen.getByRole('link', { name: content.ctaLabel });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', content.ctaHref);
  });

  it('renders titleOverride instead of content title when provided', () => {
    const content = getContent('en').freeIntroSession;

    render(
      <FreeIntroSession
        content={content}
        titleOverride={content.eventPageTitle}
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: content.eventPageTitle }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: content.title }),
    ).not.toBeInTheDocument();
  });
});
