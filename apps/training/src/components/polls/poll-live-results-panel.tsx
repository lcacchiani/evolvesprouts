'use client';

import { useEffect, useState } from 'react';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import {
  fetchPollQuestionResults,
  type PollQuestionResults,
  PollApiError,
} from '@/lib/polls-api';

const LIVE_RESULTS_POLL_MS = 3000;

const POLL_PANEL_CLASS =
  'flex flex-col gap-3 rounded-inner border es-border-panel-soft es-bg-surface-muted p-4';

export interface PollLiveResultsPanelProps {
  pollSlug: string;
  question: PollQuestion;
  common: PollsCommonContent;
}

export function PollLiveResultsPanel({
  pollSlug,
  question,
  common,
}: PollLiveResultsPanelProps) {
  const [results, setResults] = useState<PollQuestionResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      question.type !== 'select' &&
      question.type !== 'multiselect' &&
      question.type !== 'truefalse'
    ) {
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

  if (
    question.type !== 'select' &&
    question.type !== 'multiselect' &&
    question.type !== 'truefalse'
  ) {
    return null;
  }

  const buckets = mergeResultBuckets(question, results);
  const maxCount = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <section className={`${POLL_PANEL_CLASS} gap-4`}>
      <div className='flex flex-col gap-1'>
        <h2 className='es-text-heading text-lg font-semibold'>{common.liveResults.heading}</h2>
        <p className='es-text-muted text-sm'>
          {formatTotalResponses(common.liveResults.totalResponsesTemplate, results?.totalResponses ?? 0)}
        </p>
      </div>
      {errorMessage ? (
        <p className='es-text-danger text-sm' role='alert'>
          {errorMessage}
        </p>
      ) : null}
      <ul className='flex flex-col gap-3'>
        {buckets.map((bucket) => (
          <li key={bucket.label} className='flex flex-col gap-1'>
            <div className='es-text-body flex items-baseline justify-between gap-2 text-sm'>
              <span>{resolveBucketLabel(question, bucket.label, common)}</span>
              <span className='es-text-muted tabular-nums'>
                {formatCountLabel(common.liveResults.countTemplate, bucket.count)}
              </span>
            </div>
            <progress
              className='poll-live-results-bar h-3 w-full overflow-hidden rounded-full'
              value={bucket.count}
              max={maxCount}
              aria-label={`${resolveBucketLabel(question, bucket.label, common)}: ${formatCountLabel(common.liveResults.countTemplate, bucket.count)}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function mergeResultBuckets(
  question: PollQuestion,
  results: PollQuestionResults | null,
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const bucket of results?.buckets ?? []) {
    counts.set(bucket.label, bucket.count);
  }

  if (question.type === 'select' || question.type === 'multiselect') {
    return question.options.map((label) => ({
      label,
      count: counts.get(label) ?? 0,
    }));
  }

  return [
    { label: 'true', count: counts.get('true') ?? 0 },
    { label: 'false', count: counts.get('false') ?? 0 },
  ];
}

function resolveBucketLabel(
  question: PollQuestion,
  label: string,
  common: PollsCommonContent,
): string {
  if (question.type === 'truefalse') {
    if (label === 'true') {
      return common.truefalse.trueLabel;
    }
    if (label === 'false') {
      return common.truefalse.falseLabel;
    }
  }
  return label;
}

function formatTotalResponses(template: string, total: number): string {
  return template.replace('{total}', String(total));
}

function formatCountLabel(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

function resolveLoadErrorMessage(error: unknown, common: PollsCommonContent): string {
  if (error instanceof PollApiError && error.statusCode === 0) {
    return common.errors.missingApiConfig;
  }
  return common.errors.resultsLoadFailed;
}
