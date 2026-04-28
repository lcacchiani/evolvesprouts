'use client';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';

export interface AdminAccessDeniedScreenProps {
  onSignOut: () => void;
}

export function AdminAccessDeniedScreen({ onSignOut }: AdminAccessDeniedScreenProps) {
  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12'>
      <StatusBanner variant='error' title='Access not granted'>
        Your account is signed in but is not assigned to an Evolve Sprouts admin role. If you
        believe this is a mistake, contact your administrator. You can sign out below.
      </StatusBanner>
      <div>
        <Button type='button' variant='primary' onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
