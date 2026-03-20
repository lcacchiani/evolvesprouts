import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/app-shell';

const navItems = [
  { key: 'a', label: 'Section A' },
  { key: 'b', label: 'Section B' },
];

describe('AppShell', () => {
  it('renders navigation and calls onSelect when a nav item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onLogout = vi.fn();

    render(
      <AppShell
        navItems={navItems}
        activeKey='a'
        onSelect={onSelect}
        onLogout={onLogout}
        userEmail='admin@example.com'
        lastAuthTime='2025-01-15T12:00:00.000Z'
      >
        <p>Main</p>
      </AppShell>
    );

    expect(screen.getByRole('heading', { name: 'Section A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section B' })).toBeInTheDocument();
    expect(screen.getAllByText('admin@example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Last login:/).length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole('button', { name: 'Section B' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('calls onLogout from desktop header sign out', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <AppShell
        navItems={navItems}
        activeKey='a'
        onSelect={vi.fn()}
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
