import Link from 'next/link';

import { StatusBanner } from '@/components/status-banner';

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
      <StatusBanner variant='info' title='Page not found'>
        The page you requested does not exist.{' '}
        <Link href='/' className='font-semibold underline underline-offset-2'>
          Return to the admin dashboard.
        </Link>
      </StatusBanner>
    </main>
  );
}
