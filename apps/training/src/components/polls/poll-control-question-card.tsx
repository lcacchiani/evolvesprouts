'use client';

import { PollLiveResultsPanel } from '@/components/polls/poll-live-results-panel';
import { PollTextResultsPanel } from '@/components/polls/poll-text-results-panel';
import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';

export interface PollControlQuestionCardProps {
  pollSlug: string;
  question: PollQuestion;
  common: PollsCommonContent;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export function PollControlQuestionCard({
  pollSlug,
  question,
  common,
  enabled,
  disabled,
  onToggle,
}: PollControlQuestionCardProps) {
  const toggleId = `poll-control-toggle-${question.id}`;

  return (
    <article className='flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <p className='text-xs font-medium uppercase tracking-wide text-neutral-500'>
            {question.screen}
          </p>
          <h2 className='text-lg font-semibold text-neutral-900'>{question.question}</h2>
          {!enabled ? (
            <p className='text-sm text-neutral-600'>{common.control.skippedLabel}</p>
          ) : null}
        </div>
        <label
          htmlFor={toggleId}
          className='flex shrink-0 items-center gap-2 text-sm font-medium text-neutral-900'
        >
          <span>{enabled ? common.control.questionOnLabel : common.control.questionOffLabel}</span>
          <input
            id={toggleId}
            type='checkbox'
            className='h-5 w-5 rounded border-neutral-300'
            checked={enabled}
            disabled={disabled}
            onChange={onToggle}
          />
        </label>
      </div>
      {question.type === 'select' || question.type === 'truefalse' ? (
        <PollLiveResultsPanel
          pollSlug={pollSlug}
          question={{
            ...question,
            showResults: true,
          }}
          common={common}
        />
      ) : (
        <PollTextResultsPanel pollSlug={pollSlug} question={question} common={common} />
      )}
    </article>
  );
}
