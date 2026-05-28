import { PollWizard } from '@/components/polls/poll-wizard';
import type { PollContent, PollsCommonContent } from '@/content/poll-types';

export interface PollPageProps {
  poll: PollContent;
  common: PollsCommonContent;
}

export function PollPage({ poll, common }: PollPageProps) {
  return (
    <main className='flex min-h-screen flex-col px-6 py-10'>
      <header className='mx-auto mb-8 w-full max-w-xl text-center'>
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG from /public/images */}
        <img
          src='/images/evolvesprouts-logo.svg'
          alt='Evolve Sprouts'
          className='mx-auto mb-4 h-14 w-auto'
        />
        <h1 className='es-type-title text-2xl'>{poll.title}</h1>
      </header>
      <PollWizard poll={poll} common={common} />
    </main>
  );
}
