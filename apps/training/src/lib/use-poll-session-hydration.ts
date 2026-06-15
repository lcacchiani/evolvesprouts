'use client';

import { useEffect, useState } from 'react';

import {
  emptyAnswerState,
  isAnswerValid,
  mergeSessionAnswers,
  type QuestionAnswerState,
} from '@/components/polls/poll-answer-state';
import { fetchPollSessionAnswers } from '@/lib/polls-api';

type SessionHydrationStatus = 'pending' | 'ready' | 'skipped';

export function usePollSessionHydration(pollSlug: string, sessionId: string) {
  const [status, setStatus] = useState<SessionHydrationStatus>(() =>
    sessionId ? 'pending' : 'skipped',
  );
  const [answersByQuestionId, setAnswersByQuestionId] = useState<
    Record<string, QuestionAnswerState>
  >({});
  const [completedQuestionIds, setCompletedQuestionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const session = await fetchPollSessionAnswers(pollSlug, sessionId);
        if (cancelled) {
          return;
        }
        setAnswersByQuestionId(mergeSessionAnswers(session.answers));
        setCompletedQuestionIds(
          new Set(session.answers.map((item) => item.questionId).filter(Boolean)),
        );
      } catch {
        // Resume is best-effort; the respondent can still answer from scratch.
      } finally {
        if (!cancelled) {
          setStatus('ready');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pollSlug, sessionId]);

  return {
    isSessionLoading: status === 'pending',
    answersByQuestionId,
    setAnswersByQuestionId,
    completedQuestionIds,
    setCompletedQuestionIds,
  };
}

export function resolveResumeStepIndex<T extends { id: string }>(
  activeQuestions: T[],
  completedQuestionIds: ReadonlySet<string>,
): number {
  if (activeQuestions.length === 0) {
    return 0;
  }
  const nextIndex = activeQuestions.findIndex(
    (question) => !completedQuestionIds.has(question.id),
  );
  if (nextIndex >= 0) {
    return nextIndex;
  }
  return activeQuestions.length - 1;
}

export function clampStepIndex(stepIndex: number, activeQuestionCount: number): number {
  if (activeQuestionCount === 0) {
    return 0;
  }
  return Math.min(Math.max(0, stepIndex), activeQuestionCount - 1);
}
