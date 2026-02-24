'use client';

import { useState } from 'react';

import { AssetsPage } from '../components/admin/assets/assets-page';
import { AppShell } from '../components/app-shell';
import { AuthProvider, useAuth } from '../components/auth-provider';
import { LoginScreen } from '../components/login-screen';
import { StatusBanner } from '../components/status-banner';

const NAV_ITEMS = [{ key: 'assets', label: 'Client assets' }] as const;

function LoginGate() {
  const { status, user, logout } = useAuth();
  const [activeSectionKey, setActiveSectionKey] = useState<(typeof NAV_ITEMS)[number]['key']>(
    'assets'
  );

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
      <AppShell
        navItems={NAV_ITEMS.map((item) => ({ ...item }))}
        activeKey={activeSectionKey}
        onSelect={(key) => setActiveSectionKey(key as (typeof NAV_ITEMS)[number]['key'])}
        onLogout={logout}
        userEmail={user?.email}
        lastAuthTime={user?.lastAuthTime}
      >
        <AssetsPage />
      </AppShell>
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
