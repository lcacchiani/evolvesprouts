'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PollQuestion } from '@/content/poll-types';
import { buildQuestionOptionsMap } from '@/lib/poll-question-options';
import {
  fetchPollControlState,
  persistPollControlState,
  PollApiError,
} from '@/lib/polls-api';

const CONTROL_POLL_MS = 2500;

export interface UsePollControlStateOptions {
  pollSlug: string;
  /** Poll question definitions used to publish canonical options to the backend. */
  questions?: readonly PollQuestion[];
  /** When false, only polls GET (participant view). Default true for facilitator. */
  allowWrites?: boolean;
}

export interface UsePollControlStateResult {
  enabledQuestionIds: ReadonlySet<string>;
  isLoading: boolean;
  errorMessage: string | null;
  isQuestionEnabled: (questionId: string) => boolean;
  toggleQuestion: (questionId: string) => Promise<void>;
  /** Reload facilitator toggles (for example after a submit conflict). */
  refetch: () => Promise<void>;
}

export function usePollControlState({
  pollSlug,
  questions = [],
  allowWrites = true,
}: UsePollControlStateOptions): UsePollControlStateResult {
  const [enabledQuestionIds, setEnabledQuestionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const enabledRef = useRef(enabledQuestionIds);
  const questionOptions = useRef(buildQuestionOptionsMap(questions));

  useEffect(() => {
    questionOptions.current = buildQuestionOptionsMap(questions);
  }, [questions]);

  useEffect(() => {
    enabledRef.current = enabledQuestionIds;
  }, [enabledQuestionIds]);

  const applyState = useCallback((ids: string[]) => {
    setEnabledQuestionIds(new Set(ids));
  }, []);

  const refetch = useCallback(async () => {
    try {
      const state = await fetchPollControlState(pollSlug);
      applyState(state.enabledQuestionIds);
      setErrorMessage(null);
    } catch {
      setErrorMessage('load');
    } finally {
      setIsLoading(false);
    }
  }, [applyState, pollSlug]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const state = await fetchPollControlState(pollSlug);
        if (!cancelled) {
          applyState(state.enabledQuestionIds);
          setErrorMessage(null);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('load');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, CONTROL_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyState, pollSlug]);

  const isQuestionEnabled = useCallback(
    (questionId: string) => enabledQuestionIds.has(questionId),
    [enabledQuestionIds],
  );

  const toggleQuestion = useCallback(
    async (questionId: string) => {
      if (!allowWrites) {
        return;
      }

      const next = new Set(enabledRef.current);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      const nextIds = [...next];
      const previous = enabledRef.current;
      setEnabledQuestionIds(next);
      setErrorMessage(null);

      try {
        const state = await persistPollControlState(pollSlug, {
          enabledQuestionIds: nextIds,
          questionOptions: questionOptions.current,
        });
        applyState(state.enabledQuestionIds);
      } catch (error) {
        setEnabledQuestionIds(previous);
        if (error instanceof PollApiError && error.statusCode === 0) {
          setErrorMessage('config');
        } else {
          setErrorMessage('update');
        }
      }
    },
    [allowWrites, applyState, pollSlug],
  );

  return {
    enabledQuestionIds,
    isLoading,
    errorMessage,
    isQuestionEnabled,
    toggleQuestion,
    refetch,
  };
}
