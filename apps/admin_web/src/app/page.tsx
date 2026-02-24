'use client';

import { AuthProvider, useAuth } from '../components/auth-provider';
import { LoginScreen } from '../components/login-screen';
import { StatusBanner } from '../components/status-banner';
import { Button } from '../components/ui/button';

function LoginGate() {
  const { status, user, logout } = useAuth();

  if (status === 'loading') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <StatusBanner variant='info' title='Loading'>
          Preparing your admin session.
        </StatusBanner>
      </main>
    );
  }

  if (status === 'authenticated') {
    return (
      <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
        <section className='w-full space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm'>
          <StatusBanner variant='success' title='Signed in'>
            You are logged in as {user?.email ?? 'an authenticated user'}.
          </StatusBanner>
          <Button type='button' variant='outline' onClick={logout} className='w-full'>
            Sign out
          </Button>
        </section>
      </main>
    );
  }

  return <LoginScreen />;
}

export default function HomePage() {
  return (
    <AuthProvider>
      <LoginGate />
    </AuthProvider>
  );
}
