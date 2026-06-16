'use client';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { POLL_PANEL_CLASS } from '@/components/polls/poll-panel-styles';
import {
  formatTotalResponses,
  usePollQuestionResults,
} from '@/lib/use-poll-question-results';

export interface PollTextResultsPanelProps {
  pollSlug: string;
  question: PollQuestion;
  common: PollsCommonContent;
}

export function PollTextResultsPanel({
  pollSlug,
  question,
  common,
}: PollTextResultsPanelProps) {
  const enabled = question.type === 'text' || question.type === 'email';
  const { results, errorMessage } = usePollQuestionResults({
    pollSlug,
    question,
    common,
    enabled,
  });

  if (!enabled) {
    return null;
  }

  const responses = results?.responses ?? [];

  return (
    <section className={POLL_PANEL_CLASS}>
      <div className='flex flex-col gap-1'>
        <h3 className='es-text-heading text-base font-semibold'>
          {common.control.textResponsesHeading}
        </h3>
        <p className='es-text-muted text-sm'>
          {formatTotalResponses(common.liveResults.totalResponsesTemplate, results?.totalResponses ?? 0)}
        </p>
      </div>
      {errorMessage ? (
        <p className='es-text-danger text-sm' role='alert'>
          {errorMessage}
        </p>
      ) : null}
      {responses.length === 0 && !errorMessage ? (
        <p className='es-text-muted text-sm'>{common.control.noTextResponses}</p>
      ) : (
        <ul className='flex max-h-48 flex-col gap-2 overflow-y-auto text-sm'>
          {responses.map((response, index) => (
            <li
              key={`${response}-${index}`}
              className='es-text-body rounded-inner border es-border-panel-soft es-bg-surface-white px-3 py-2'
            >
              {response}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
