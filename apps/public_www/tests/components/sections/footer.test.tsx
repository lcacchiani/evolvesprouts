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

    const sharedContainers = document.querySelectorAll('.es-layout-container');
    expect(sharedContainers.length).toBeGreaterThan(0);

    const linkedInLinks = screen.getAllByRole('link', { name: 'Linkedin' });
    expect(linkedInLinks.length).toBeGreaterThan(0);
    for (const link of linkedInLinks) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.querySelector('span:last-of-type')?.className).toContain(
        'es-link-external-label',
      );
      const externalIcon = link.querySelector('svg[data-external-link-icon="true"]');
      expect(externalIcon).not.toBeNull();
      expect(externalIcon?.getAttribute('class')).toContain('es-link-external-icon');
    }
    expect(screen.queryByRole('link', { name: 'Facebook' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Tiktok/i })).toBeNull();

    const homeLinks = screen.getAllByRole('link', { name: 'Home' });
    expect(homeLinks.length).toBeGreaterThan(0);
    for (const link of homeLinks) {
      expect(link.querySelector('span:last-of-type')?.className ?? '').not.toContain(
        'es-link-external-label',
      );
      expect(link.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    }
  });

  it('keeps mobile logo non-interactive and full-width accordion tap targets', () => {
    render(<Footer content={enContent.footer} />);

    const footerTopSection = document.querySelector('footer section');
    expect(footerTopSection?.className).toContain('es-section-shell-spacing');

    const mobileFooterSection = document.querySelector('div.sm\\:hidden');
    expect(mobileFooterSection).not.toBeNull();
    expect(
      mobileFooterSection?.querySelector('div.pointer-events-none'),
    ).not.toBeNull();

    const accordionSummaries = document.querySelectorAll('summary');
    expect(accordionSummaries.length).toBeGreaterThan(0);
    for (const summary of accordionSummaries) {
      expect(summary.className).toContain('w-full');
    }
  });

  it('removes desktop gap around the centered logo column', () => {
    render(<Footer content={enContent.footer} />);

    const desktopGrid = document.querySelector(
      'div.hidden.grid-cols-1',
    ) as HTMLDivElement | null;
    expect(desktopGrid).not.toBeNull();
    expect(desktopGrid?.className).toContain('lg:gap-x-0');

    const desktopColumns = desktopGrid?.querySelectorAll('section') ?? [];
    expect(desktopColumns).toHaveLength(4);
    expect(desktopColumns[1]?.className).toContain('lg:pl-6');
    expect(desktopColumns[2]?.className).not.toContain('lg:pl-6');
    expect(desktopColumns[3]?.className).toContain('lg:pl-6');
  });
});
