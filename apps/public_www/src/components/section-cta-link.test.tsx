import { render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SectionCtaAnchor } from '@/components/section-cta-link';

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

describe('SectionCtaAnchor', () => {
  it('renders the shared external link icon for external href values', () => {
    render(<SectionCtaAnchor href='https://example.com'>Visit resource</SectionCtaAnchor>);

    const link = screen.getByRole('link', { name: 'Visit resource' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link.className).toContain('es-section-cta');
    const label = screen.getByText('Visit resource');
    expect(label.className).toContain('underline');
    const externalIcon = link.querySelector('svg[data-external-link-icon="true"]');
    expect(
      externalIcon,
    ).not.toBeNull();
    expect(externalIcon?.getAttribute('class')).toContain('border-b');
  });

  it('keeps the chevron icon for internal href values', () => {
    render(<SectionCtaAnchor href='/about-us'>About us</SectionCtaAnchor>);

    const link = screen.getByRole('link', { name: 'About us' });
    expect(link.className).toContain('es-section-cta');
    expect(link.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    expect(link.querySelector('path[d="M7 4L13 10L7 16"]')).not.toBeNull();
  });
});
