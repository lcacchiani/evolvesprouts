import { StatusBanner } from '@/components/status-banner';

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
      <StatusBanner variant='info' title='Page not found'>
        The page you requested does not exist. Return to the admin dashboard.
      </StatusBanner>
    </main>
  );
}
