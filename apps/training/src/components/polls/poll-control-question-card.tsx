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
    <article className='flex flex-col gap-4 rounded-card border es-border-panel es-bg-surface-white p-5 shadow-card'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <p className='es-type-eyebrow text-xs'>{question.screen}</p>
          <h2 className='es-text-heading text-lg font-semibold'>{question.question}</h2>
          {!enabled ? (
            <p className='es-text-muted text-sm'>{common.control.skippedLabel}</p>
          ) : null}
        </div>
        <label
          htmlFor={toggleId}
          className='es-text-heading flex shrink-0 items-center gap-2 text-sm font-medium'
        >
          <span>{enabled ? common.control.questionOnLabel : common.control.questionOffLabel}</span>
          <input
            id={toggleId}
            type='checkbox'
            className='es-accent-brand es-focus-ring h-5 w-5 rounded'
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
