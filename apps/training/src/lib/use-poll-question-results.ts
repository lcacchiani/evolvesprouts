'use client';

import { useEffect, useState } from 'react';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import {
  fetchPollQuestionResults,
  type PollQuestionResults,
  PollApiError,
} from '@/lib/polls-api';
import { formatTemplateValue } from '@/lib/format-template';

export const POLL_QUESTION_RESULTS_POLL_MS = 3000;

export interface UsePollQuestionResultsInput {
  pollSlug: string;
  question: PollQuestion;
  common: PollsCommonContent;
  enabled: boolean;
}

export interface UsePollQuestionResultsResult {
  results: PollQuestionResults | null;
  errorMessage: string | null;
}

export function usePollQuestionResults({
  pollSlug,
  question,
  common,
  enabled,
}: UsePollQuestionResultsInput): UsePollQuestionResultsResult {
  const [results, setResults] = useState<PollQuestionResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    async function loadResults(): Promise<void> {
      try {
        const next = await fetchPollQuestionResults({
          pollSlug,
          questionId: question.id,
          questionType: question.type as
            | 'select'
            | 'multiselect'
            | 'truefalse'
            | 'text'
            | 'email',
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
    }, POLL_QUESTION_RESULTS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [common, enabled, pollSlug, question]);

  return { results, errorMessage };
}

export function formatTotalResponses(template: string, total: number): string {
  return formatTemplateValue(template, 'total', total);
}

export function formatCountLabel(template: string, count: number): string {
  return formatTemplateValue(template, 'count', count);
}

export function resolvePollResultsLoadErrorMessage(
  error: unknown,
  common: PollsCommonContent,
): string {
  if (error instanceof PollApiError && error.statusCode === 0) {
    return common.errors.missingApiConfig;
  }
  return common.errors.resultsLoadFailed;
}

function resolveLoadErrorMessage(error: unknown, common: PollsCommonContent): string {
  return resolvePollResultsLoadErrorMessage(error, common);
}
