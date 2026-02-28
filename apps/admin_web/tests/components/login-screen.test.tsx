import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

vi.mock('@/components/auth-provider', () => ({
  useAuth: mockUseAuth,
}));

import { LoginScreen } from '@/components/login-screen';

function createAuthContext(overrides: Partial<ReturnType<typeof mockUseAuth>> = {}) {
  return {
    login: vi.fn().mockResolvedValue(undefined),
    configErrors: [] as string[],
    error: '',
    passwordlessStatus: 'idle' as const,
    passwordlessError: '',
    passwordlessEmail: '',
    sendPasswordlessCode: vi.fn().mockResolvedValue(undefined),
    verifyPasswordlessCode: vi.fn().mockResolvedValue(undefined),
    resetPasswordless: vi.fn(),
    ...overrides,
  };
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows email validation feedback and submits passwordless request', async () => {
    const user = userEvent.setup();
    const authContext = createAuthContext();
    mockUseAuth.mockReturnValue(authContext);

    render(<LoginScreen />);

    await user.type(screen.getByLabelText('Work email *'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Email me a verification code' }));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(authContext.sendPasswordlessCode).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Work email *'));
    await user.type(screen.getByLabelText('Work email *'), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: 'Email me a verification code' }));

    expect(authContext.sendPasswordlessCode).toHaveBeenCalledWith('admin@example.com');
  });

  it('shows verification code flow when challenge is active', async () => {
    const user = userEvent.setup();
    const authContext = createAuthContext({
      passwordlessStatus: 'challenge',
      passwordlessEmail: 'admin@example.com',
    });
    mockUseAuth.mockReturnValue(authContext);

    render(<LoginScreen />);

    expect(screen.getByLabelText('Verification code *')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(authContext.resetPasswordless).toHaveBeenCalledTimes(1);
  });

  it('triggers Google login and respects disabled state from config errors', async () => {
    const user = userEvent.setup();
    const enabledAuthContext = createAuthContext();
    mockUseAuth.mockReturnValue(enabledAuthContext);

    const { rerender } = render(<LoginScreen />);
    const googleButton = screen.getByRole('button', { name: 'Continue with Google' });
    expect(googleButton).toBeEnabled();

    await user.click(googleButton);
    expect(enabledAuthContext.login).toHaveBeenCalledWith({ provider: 'Google', returnTo: '/' });

    const disabledAuthContext = createAuthContext({
      configErrors: ['NEXT_PUBLIC_COGNITO_DOMAIN is missing.'],
    });
    mockUseAuth.mockReturnValue(disabledAuthContext);
    rerender(<LoginScreen />);

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  });
});
