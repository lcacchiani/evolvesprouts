'use client';

import { PollControlQuestionCard } from '@/components/polls/poll-control-question-card';
import type { PollContent, PollsCommonContent } from '@/content/poll-types';
import { usePollControlState } from '@/lib/use-poll-control-state';

export interface PollControlPageProps {
  poll: PollContent;
  common: PollsCommonContent;
}

export function PollControlPage({ poll, common }: PollControlPageProps) {
  const { enabledQuestionIds, isLoading, errorMessage, isQuestionEnabled, toggleQuestion } =
    usePollControlState({ pollSlug: poll.slug, allowWrites: true });

  const bannerMessage = resolveBannerMessage(errorMessage, common);

  return (
    <main className='flex min-h-screen flex-col px-6 py-10'>
      <header className='mx-auto mb-8 w-full max-w-3xl text-center'>
        <h1 className='es-type-title text-2xl'>{common.control.title}</h1>
        <p className='es-text-body mt-2 text-base'>{poll.title}</p>
        <p className='es-text-muted mt-1 text-sm'>{common.control.description}</p>
      </header>
      {bannerMessage ? (
        <p className='es-text-danger mx-auto mb-4 w-full max-w-3xl text-sm' role='alert'>
          {bannerMessage}
        </p>
      ) : null}
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
        {poll.questions.map((question) => (
          <PollControlQuestionCard
            key={question.id}
            pollSlug={poll.slug}
            question={question}
            common={common}
            enabled={isQuestionEnabled(question.id)}
            disabled={isLoading}
            onToggle={() => {
              void toggleQuestion(question.id);
            }}
          />
        ))}
      </div>
      {!isLoading && enabledQuestionIds.size === 0 ? (
        <p className='es-text-muted mx-auto mt-6 w-full max-w-3xl text-center text-sm'>
          {common.waiting.description}
        </p>
      ) : null}
    </main>
  );
}

function resolveBannerMessage(
  code: string | null,
  common: PollsCommonContent,
): string | null {
  if (code === 'load') {
    return common.control.loadFailed;
  }
  if (code === 'update' || code === 'config') {
    return common.control.updateFailed;
  }
  return null;
}
