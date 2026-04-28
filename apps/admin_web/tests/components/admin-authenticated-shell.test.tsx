import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mockUsePathname = vi.fn(() => '/finance');

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

const mockUseAuth = vi.fn();

vi.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

import { AdminAuthenticatedShell } from '@/components/admin-authenticated-shell';

describe('AdminAuthenticatedShell', () => {
  it('shows access denied with sign out when authenticated without staff groups', async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    mockUseAuth.mockReturnValue({
      status: 'authenticated_no_access',
      user: { email: 'x@example.com', groups: [] },
      logout,
    });

    render(
      <AdminAuthenticatedShell>
        <p>Secret</p>
      </AdminAuthenticatedShell>
    );

    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(screen.getByText(/Access not granted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('renders app shell when authenticated with staff group', () => {
    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      user: { email: 'a@example.com', groups: ['manager'] },
      logout: vi.fn(),
    });

    render(
      <AdminAuthenticatedShell>
        <p>Dashboard</p>
      </AdminAuthenticatedShell>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
