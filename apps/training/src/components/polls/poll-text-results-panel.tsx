'use client';

import { useEffect, useState } from 'react';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import {
  fetchPollQuestionResults,
  PollApiError,
  type PollQuestionResults,
} from '@/lib/polls-api';

const LIVE_RESULTS_POLL_MS = 3000;

const POLL_PANEL_CLASS =
  'flex flex-col gap-3 rounded-inner border es-border-panel-soft es-bg-surface-muted p-4';

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
  const [results, setResults] = useState<PollQuestionResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (question.type !== 'text' && question.type !== 'email') {
      return;
    }

    let cancelled = false;

    async function loadResults(): Promise<void> {
      try {
        const next = await fetchPollQuestionResults({
          pollSlug,
          questionId: question.id,
          questionType: question.type,
        });
        if (!cancelled) {
          setResults(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(resolveLoadErrorMessage(error, common));
        }
      }
    }

    void loadResults();
    const intervalId = window.setInterval(() => {
      void loadResults();
    }, LIVE_RESULTS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [common, pollSlug, question]);

  if (question.type !== 'text' && question.type !== 'email') {
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

function formatTotalResponses(template: string, total: number): string {
  return template.replace('{total}', String(total));
}

function resolveLoadErrorMessage(error: unknown, common: PollsCommonContent): string {
  if (error instanceof PollApiError && error.statusCode === 0) {
    return common.errors.missingApiConfig;
  }
  return common.errors.resultsLoadFailed;
}
