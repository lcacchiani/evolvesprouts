'use client';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
      <div className='w-full space-y-4'>
        <StatusBanner variant='error' title='Something went wrong'>
          {error.message || 'An unexpected error occurred.'}
        </StatusBanner>
        <Button type='button' onClick={reset} className='w-full'>
          Try again
        </Button>
      </div>
    </main>
  );
}
