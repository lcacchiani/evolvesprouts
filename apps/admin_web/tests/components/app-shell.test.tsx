import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AppShell } from '@/components/app-shell';

const navItems = [
  { key: 'a', label: 'Section A', href: '/a' },
  { key: 'b', label: 'Section B', href: '/b' },
];

describe('AppShell', () => {
  it('renders navigation links for each section', () => {
    const onLogout = vi.fn();

    render(
      <AppShell
        navItems={navItems}
        activeKey='a'
        onLogout={onLogout}
        userEmail='admin@example.com'
        lastAuthTime='2025-01-15T12:00:00.000Z'
      >
        <p>Main</p>
      </AppShell>
    );

    expect(screen.getByRole('heading', { name: 'Section A' })).toBeInTheDocument();
    const sectionBLink = screen.getByRole('link', { name: 'Section B' });
    expect(sectionBLink).toHaveAttribute('href', '/b');
    expect(screen.getAllByText('admin@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Last login:/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onLogout from desktop header sign out', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <AppShell
        navItems={navItems}
        activeKey='a'
        onLogout={onLogout}
        userEmail='admin@example.com'
      >
        <p>Main</p>
      </AppShell>
    );

    const signOutButtons = screen.getAllByRole('button', { name: 'Sign out' });
    expect(signOutButtons.length).toBe(2);

    await user.click(signOutButtons[0]);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
