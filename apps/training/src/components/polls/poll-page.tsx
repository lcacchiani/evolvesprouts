import { PollWizard } from '@/components/polls/poll-wizard';
import type { PollContent, PollsCommonContent } from '@/content/poll-types';
import { getPublicWwwHomeUrl } from '@/lib/public-www-url';

export interface PollPageProps {
  poll: PollContent;
  common: PollsCommonContent;
}

export function PollPage({ poll, common }: PollPageProps) {
  const publicWwwHomeUrl = getPublicWwwHomeUrl();

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG from /public/images
    <img
      src='/images/evolvesprouts-logo.svg'
      alt='Evolve Sprouts'
      className='mx-auto h-28 w-auto'
    />
  );

  return (
    <main className='flex min-h-screen flex-col px-6 py-10'>
      <header className='mx-auto mb-8 w-full max-w-xl text-center'>
        <div className='mb-4'>
          {publicWwwHomeUrl ? (
            <a
              href={publicWwwHomeUrl}
              className='inline-block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900'
              aria-label='Go to the Evolve Sprouts website'
            >
              {logo}
            </a>
          ) : (
            logo
          )}
        </div>
        <h1 className='es-type-title text-2xl'>{poll.title}</h1>
      </header>
      <PollWizard poll={poll} common={common} />
    </main>
  );
}
