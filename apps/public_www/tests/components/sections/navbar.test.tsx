import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Navbar } from '@/components/sections/navbar';
import enContent from '@/content/en.json';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/events',
}));

vi.mock('next/image', () => ({
  default: function MockImage(props: ComponentProps<'img'>) {
    return (
      <div
        data-next-image-src={
          typeof props.src === 'string' ? props.src : 'non-string-src'
        }
        data-next-image-alt={props.alt ?? ''}
      />
    );
  },
}));

interface MockLinkProps extends Omit<ComponentProps<'a'>, 'href'> {
  href: string;
  children: ReactNode;
}

vi.mock('next/link', () => ({
  default: function MockLink({ href, children, ...props }: MockLinkProps) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

describe('Navbar desktop submenu accessibility', () => {
  it('uses shared layout container class on desktop nav wrapper', () => {
    render(<Navbar content={enContent.navbar} />);

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('es-layout-container');

    const header = document.querySelector('header[data-figma-node="navbar"]');
    expect(header?.className).toContain('es-navbar-surface');
    expect(header?.className).toContain('relative');
    expect(header?.className).toContain('z-30');
  });

  it('applies active and inactive classes to language menu items', () => {
    render(<Navbar content={enContent.navbar} />);

    const toggle = screen.getByRole('button', {
      name: /Selected language: English/i,
    });
    fireEvent.click(toggle);

    const englishOption = screen.getByRole('menuitem', { name: /English/i });
    const simplifiedChineseOption = screen.getByRole('menuitem', {
      name: /Chinese \(Simplified\)/i,
    });

    expect(englishOption.className).toContain('es-nav-language-option');
    expect(englishOption.className).toContain('es-nav-language-option--active');
    expect(simplifiedChineseOption.className).toContain('es-nav-language-option');
    expect(simplifiedChineseOption.className).toContain(
      'es-nav-language-option--inactive',
    );
  });

  it('restores focus to the submenu trigger before hiding links', () => {
    render(<Navbar content={enContent.navbar} />);

    const submenuToggle = screen.getByRole('button', {
      name: 'Toggle Training Courses submenu',
    });
    fireEvent.click(submenuToggle);

    const submenuId = submenuToggle.getAttribute('aria-controls');
    expect(submenuId).toBeTruthy();

    const submenu = document.getElementById(submenuId as string);
    expect(submenu).not.toBeNull();
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'true');
    expect(submenu).not.toHaveAttribute('aria-hidden', 'true');

    const submenuLink = within(submenu as HTMLElement).getByRole('link', {
      name: 'Auntie Training',
    });
    submenuLink.focus();
    expect(submenuLink).toHaveFocus();

    const submenuWrapper = submenuToggle.closest('li');
    expect(submenuWrapper).not.toBeNull();
    fireEvent.mouseLeave(submenuWrapper as HTMLElement);

    expect(submenuToggle).toHaveFocus();
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'false');
    expect(submenu).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps training submenu open on first click after hover', () => {
    render(<Navbar content={enContent.navbar} />);

    const submenuToggle = screen.getByRole('button', {
      name: 'Toggle Training Courses submenu',
    });
    const submenuWrapper = submenuToggle.closest('li');

    expect(submenuWrapper).not.toBeNull();
    fireEvent.mouseEnter(submenuWrapper as HTMLElement);
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(submenuToggle);
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(submenuToggle);
    expect(submenuToggle).toHaveAttribute('aria-expanded', 'false');
  });
});
