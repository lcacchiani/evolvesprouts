/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Footer } from '@/components/sections/footer';
import enContent from '@/content/en.json';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

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

describe('Footer external links', () => {
  it('adds the shared external icon to social links only', () => {
    render(<Footer content={enContent.footer} />);

    const facebookLinks = screen.getAllByRole('link', { name: 'Facebook' });
    expect(facebookLinks.length).toBeGreaterThan(0);
    for (const link of facebookLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.querySelector('span:last-of-type')?.className).toContain(
        'es-link-external-label',
      );
      const externalIcon = link.querySelector('svg[data-external-link-icon="true"]');
      expect(externalIcon).not.toBeNull();
      expect(externalIcon?.getAttribute('class')).toContain('es-link-external-icon');
      expect(externalIcon?.getAttribute('class')).toContain(
        'es-link-external-icon--inline',
      );
    }

    const homeLinks = screen.getAllByRole('link', { name: 'Home' });
    expect(homeLinks.length).toBeGreaterThan(0);
    for (const link of homeLinks) {
      expect(link.querySelector('span:last-of-type')?.className ?? '').not.toContain(
        'es-link-external-label',
      );
      expect(link.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    }
  });
});
