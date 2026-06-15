'use client';

import { useMemo, useState } from 'react';

import {
  emptyAnswerState,
  hasUnlockablePollQuestions,
  type QuestionAnswerState,
} from '@/components/polls/poll-answer-state';
import { PollWizardActiveStep } from '@/components/polls/poll-wizard-active-step';
import type { PollContent, PollsCommonContent } from '@/content/poll-types';
import { formatProgressLabel } from '@/lib/format-template';
import { getOrCreatePollSessionId } from '@/lib/poll-session';
import {
  clampStepIndex,
  resolveResumeStepIndex,
  usePollSessionHydration,
} from '@/lib/use-poll-session-hydration';
import { usePollControlState } from '@/lib/use-poll-control-state';

export interface PollWizardProps {
  poll: PollContent;
  common: PollsCommonContent;
}

interface ManualNavigation {
  stepIndex: number;
  activeQuestionIdsKey: string;
}

export function PollWizard({ poll, common }: PollWizardProps) {
  const sessionId = useMemo(() => getOrCreatePollSessionId(poll.slug), [poll.slug]);
  const {
    isSessionLoading,
    answersByQuestionId,
    setAnswersByQuestionId,
    completedQuestionIds,
    setCompletedQuestionIds,
  } = usePollSessionHydration(poll.slug, sessionId);

  const [manualNavigation, setManualNavigation] = useState<ManualNavigation | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    enabledQuestionIds,
    isLoading: isControlLoading,
    refetch: refetchPollControl,
  } = usePollControlState({
    pollSlug: poll.slug,
    questions: poll.questions,
    allowWrites: false,
  });

  const activeQuestions = useMemo(
    () => poll.questions.filter((question) => enabledQuestionIds.has(question.id)),
    [enabledQuestionIds, poll.questions],
  );

  const activeQuestionIdsKey = useMemo(
    () => activeQuestions.map((question) => question.id).join(','),
    [activeQuestions],
  );

  const hasUnlockableQuestions = useMemo(
    () => hasUnlockablePollQuestions(poll.questions, enabledQuestionIds),
    [enabledQuestionIds, poll.questions],
  );

  const isCaughtUp = useMemo(() => {
    if (activeQuestions.length === 0) {
      return false;
    }
    return activeQuestions.every((question) => completedQuestionIds.has(question.id));
  }, [activeQuestions, completedQuestionIds]);

  const resumeStepIndex = useMemo(
    () => resolveResumeStepIndex(activeQuestions, completedQuestionIds),
    [activeQuestions, completedQuestionIds],
  );

  const effectiveStepIndex = useMemo(() => {
    if (
      manualNavigation !== null &&
      manualNavigation.activeQuestionIdsKey === activeQuestionIdsKey
    ) {
      return clampStepIndex(manualNavigation.stepIndex, activeQuestions.length);
    }
    return resumeStepIndex;
  }, [
    activeQuestionIdsKey,
    activeQuestions.length,
    manualNavigation,
    resumeStepIndex,
  ]);

  const currentQuestion = activeQuestions[effectiveStepIndex];
  const currentAnswer = currentQuestion
    ? (answersByQuestionId[currentQuestion.id] ?? emptyAnswerState())
    : emptyAnswerState();

  const progressLabel = formatProgressLabel(
    common.a11y.progressTemplate,
    activeQuestions.length === 0 ? 0 : effectiveStepIndex + 1,
    activeQuestions.length,
  );

  const isBootstrapping = isControlLoading || isSessionLoading;

  if (!isBootstrapping && activeQuestions.length === 0) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <h2 className='es-type-title text-2xl'>{common.waiting.title}</h2>
        <p className='es-text-body text-base'>{common.waiting.description}</p>
      </section>
    );
  }

  if (isBootstrapping || !currentQuestion) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <p className='es-text-body text-base'>{common.waiting.description}</p>
      </section>
    );
  }

  if (isCaughtUp) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <h2 className='es-type-title text-2xl'>{common.completion.title}</h2>
        <p className='es-text-body text-base'>{common.completion.description}</p>
        {hasUnlockableQuestions ? (
          <p className='es-text-body text-base'>
            {common.completion.moreComingDescription}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <PollWizardActiveStep
      key={currentQuestion.id}
      poll={poll}
      common={common}
      sessionId={sessionId}
      activeQuestions={activeQuestions}
      question={currentQuestion}
      answer={currentAnswer}
      stepIndex={effectiveStepIndex}
      progressLabel={progressLabel}
      isSaving={isSaving}
      errorMessage={errorMessage}
      onAnswerChange={(patch) => updateAnswerState(currentQuestion.id, patch)}
      onBack={() => {
        setErrorMessage(null);
        setManualNavigation({
          stepIndex: Math.max(0, effectiveStepIndex - 1),
          activeQuestionIdsKey,
        });
      }}
      onErrorMessage={setErrorMessage}
      onSavingChange={setIsSaving}
      onPersistSuccess={() => {
        setCompletedQuestionIds((previous) => {
          const next = new Set(previous);
          next.add(currentQuestion.id);
          return next;
        });
      }}
      onAdvance={() => {
        setManualNavigation({
          stepIndex: Math.min(effectiveStepIndex + 1, activeQuestions.length - 1),
          activeQuestionIdsKey,
        });
      }}
      onResyncControl={refetchPollControl}
    />
  );

  function updateAnswerState(
    questionId: string,
    patch: Partial<QuestionAnswerState>,
  ): void {
    setAnswersByQuestionId((previous) => ({
      ...previous,
      [questionId]: {
        ...emptyAnswerState(),
        ...previous[questionId],
        ...patch,
      },
    }));
  }
}
