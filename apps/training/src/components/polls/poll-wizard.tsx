'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  emptyAnswerState,
  hasUnlockablePollQuestions,
  isAnswerValid,
  mergeSessionAnswers,
  type QuestionAnswerState,
} from '@/components/polls/poll-answer-state';
import { PollAnswerPanel } from '@/components/polls/poll-answer-panel';
import { PollLiveResultsPanel } from '@/components/polls/poll-live-results-panel';
import { PollQuestionField } from '@/components/polls/poll-question-field';
import type { PollContent, PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { getOrCreatePollSessionId } from '@/lib/poll-session';
import {
  fetchPollSessionAnswers,
  PollApiError,
  persistPollAnswer,
} from '@/lib/polls-api';
import { usePollControlState } from '@/lib/use-poll-control-state';

export interface PollWizardProps {
  poll: PollContent;
  common: PollsCommonContent;
}

type StepPhase = 'answer' | 'feedback' | 'liveResults';

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

  const { enabledQuestionIds, isLoading: isControlLoading } = usePollControlState({
    pollSlug: poll.slug,
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

  const progressLabel = formatProgressLabel({
    template: common.a11y.progressTemplate,
    current: activeQuestions.length === 0 ? 0 : effectiveStepIndex + 1,
    total: activeQuestions.length,
  });

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
      activeQuestionIdsKey={activeQuestionIdsKey}
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

interface PollWizardActiveStepProps {
  poll: PollContent;
  common: PollsCommonContent;
  sessionId: string;
  activeQuestions: PollQuestion[];
  activeQuestionIdsKey: string;
  question: PollQuestion;
  answer: QuestionAnswerState;
  stepIndex: number;
  progressLabel: string;
  isSaving: boolean;
  errorMessage: string | null;
  onAnswerChange: (patch: Partial<QuestionAnswerState>) => void;
  onBack: () => void;
  onErrorMessage: (message: string | null) => void;
  onSavingChange: (isSaving: boolean) => void;
  onPersistSuccess: () => void;
  onAdvance: () => void;
}

function PollWizardActiveStep({
  poll,
  common,
  sessionId,
  activeQuestions,
  question,
  answer,
  stepIndex,
  progressLabel,
  isSaving,
  errorMessage,
  onAnswerChange,
  onBack,
  onErrorMessage,
  onSavingChange,
  onPersistSuccess,
  onAdvance,
}: PollWizardActiveStepProps) {
  const [stepPhase, setStepPhase] = useState<StepPhase>('answer');

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === activeQuestions.length - 1;
  const showingFeedback = stepPhase === 'feedback' && question.showAnswer;
  const showingLiveResults = stepPhase === 'liveResults' && question.showResults;
  const onInterstitial = showingFeedback || showingLiveResults;
  const primaryLabel = resolvePrimaryLabel({
    common,
    isLastStep,
    onInterstitial,
  });

  return (
    <section className='mx-auto flex w-full max-w-xl flex-col gap-6'>
      <p className='es-text-muted text-sm'>{progressLabel}</p>
      {showingFeedback ? (
        <PollAnswerPanel question={question} common={common} answer={answer} />
      ) : null}
      {showingLiveResults ? (
        <PollLiveResultsPanel pollSlug={poll.slug} question={question} common={common} />
      ) : null}
      {!onInterstitial ? (
        <PollQuestionField
          question={question}
          common={common}
          answer={answer}
          onAnswerChange={onAnswerChange}
        />
      ) : null}
      {errorMessage ? (
        <p className='es-text-danger text-sm' role='alert'>
          {errorMessage}
        </p>
      ) : null}
      <div className='flex flex-wrap items-center justify-start gap-2'>
        {!isFirstStep && !onInterstitial ? (
          <button
            type='button'
            className='es-btn es-btn--primary es-btn--outline es-focus-ring'
            disabled={isSaving}
            onClick={onBack}
          >
            {common.navigation.back}
          </button>
        ) : null}
        <button
          type='button'
          className='es-btn es-btn--primary es-focus-ring'
          disabled={isSaving}
          onClick={() => void handlePrimaryAction()}
        >
          {primaryLabel}
        </button>
      </div>
    </section>
  );

  async function handlePrimaryAction(): Promise<void> {
    onErrorMessage(null);

    if (onInterstitial) {
      if (showingFeedback && question.showResults) {
        setStepPhase('liveResults');
        return;
      }
      if (!isLastStep) {
        onAdvance();
      }
      return;
    }

    const validationError = validateAnswer(question, answer, common);
    if (validationError) {
      onErrorMessage(validationError);
      return;
    }

    onSavingChange(true);
    try {
      await persistPollAnswer({
        pollSlug: poll.slug,
        sessionId,
        question,
        answer,
      });
    } catch (error) {
      onErrorMessage(resolvePersistErrorMessage(error, common));
      onSavingChange(false);
      return;
    }
    onSavingChange(false);
    onPersistSuccess();

    if (question.showAnswer) {
      setStepPhase('feedback');
      return;
    }

    if (question.showResults) {
      setStepPhase('liveResults');
      return;
    }

    if (!isLastStep) {
      onAdvance();
    }
  }
}

type SessionHydrationStatus = 'pending' | 'ready' | 'skipped';

function usePollSessionHydration(pollSlug: string, sessionId: string) {
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

function resolveResumeStepIndex(
  activeQuestions: PollQuestion[],
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

function clampStepIndex(stepIndex: number, activeQuestionCount: number): number {
  if (activeQuestionCount === 0) {
    return 0;
  }
  return Math.min(Math.max(0, stepIndex), activeQuestionCount - 1);
}

function resolvePersistErrorMessage(
  error: unknown,
  common: PollsCommonContent,
): string {
  if (error instanceof PollApiError && error.statusCode === 0) {
    return common.errors.missingApiConfig;
  }
  return common.errors.persistFailed;
}

function validateAnswer(
  question: PollQuestion,
  answer: QuestionAnswerState,
  common: PollsCommonContent,
): string | null {
  if (!isAnswerValid(question, answer)) {
    if (question.type === 'email') {
      return common.errors.invalidEmail;
    }
    return common.errors.required;
  }
  return null;
}

function resolvePrimaryLabel({
  common,
  isLastStep,
  onInterstitial,
}: {
  common: PollsCommonContent;
  isLastStep: boolean;
  onInterstitial: boolean;
}): string {
  if (onInterstitial) {
    return common.navigation.continue;
  }
  if (isLastStep) {
    return common.navigation.finish;
  }
  return common.navigation.next;
}

function formatProgressLabel({
  template,
  current,
  total,
}: {
  template: string;
  current: number;
  total: number;
}): string {
  return template
    .replace('{current}', String(current))
    .replace('{total}', String(total));
}
