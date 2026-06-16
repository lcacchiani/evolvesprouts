'use client';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { POLL_PANEL_CLASS } from '@/components/polls/poll-panel-styles';
import {
  formatCountLabel,
  formatTotalResponses,
  usePollQuestionResults,
} from '@/lib/use-poll-question-results';

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
  const enabled =
    question.type === 'select' ||
    question.type === 'multiselect' ||
    question.type === 'truefalse';
  const { results, errorMessage } = usePollQuestionResults({
    pollSlug,
    question,
    common,
    enabled,
  });

  if (!enabled) {
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
  results: { buckets?: Array<{ label: string; count: number }> } | null,
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
