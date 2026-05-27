import { getPublicWwwHomeUrl } from '@/lib/public-www-url';

export default function NotFound() {
  const publicWwwHomeUrl = getPublicWwwHomeUrl();

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG from /public/images
    <img
      src='/images/evolvesprouts-logo.svg'
      alt='Evolve Sprouts'
      className='h-80 w-auto max-w-[min(100%,32rem)]'
    />
  );

  return (
    <main className='flex min-h-screen items-center justify-center p-6'>
      {publicWwwHomeUrl ? (
        <a
          href={publicWwwHomeUrl}
          className='rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900'
          aria-label='Go to the Evolve Sprouts website'
        >
          {logo}
        </a>
      ) : (
        logo
      )}
    </main>
  );
}
