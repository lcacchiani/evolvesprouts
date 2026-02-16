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
});
