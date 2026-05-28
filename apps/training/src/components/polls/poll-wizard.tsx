'use client';

import { useMemo, useState } from 'react';

import {
  emptyAnswerState,
  isAnswerValid,
  type QuestionAnswerState,
} from '@/components/polls/poll-answer-state';
import { PollAnswerPanel } from '@/components/polls/poll-answer-panel';
import { PollLiveResultsPanel } from '@/components/polls/poll-live-results-panel';
import { PollQuestionField } from '@/components/polls/poll-question-field';
import type { PollContent, PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { getOrCreatePollSessionId } from '@/lib/poll-session';
import { PollApiError, persistPollAnswer } from '@/lib/polls-api';
import { usePollControlState } from '@/lib/use-poll-control-state';

export interface PollWizardProps {
  poll: PollContent;
  common: PollsCommonContent;
}

type StepPhase = 'answer' | 'feedback' | 'liveResults';

export function PollWizard({ poll, common }: PollWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepPhase, setStepPhase] = useState<StepPhase>('answer');
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<
    Record<string, QuestionAnswerState>
  >({});

  const sessionId = useMemo(() => getOrCreatePollSessionId(), []);
  const { enabledQuestionIds, isLoading: isControlLoading } = usePollControlState({
    pollSlug: poll.slug,
    allowWrites: false,
  });

  const activeQuestions = useMemo(
    () => poll.questions.filter((question) => enabledQuestionIds.has(question.id)),
    [enabledQuestionIds, poll.questions],
  );

  const resolvedStepIndex =
    activeQuestions.length === 0 ? 0 : Math.min(stepIndex, activeQuestions.length - 1);

  const totalSteps = activeQuestions.length;
  const currentQuestion = activeQuestions[resolvedStepIndex];
  const currentAnswer = currentQuestion
    ? (answersByQuestionId[currentQuestion.id] ?? emptyAnswerState())
    : emptyAnswerState();

  const progressLabel = formatProgressLabel({
    template: common.a11y.progressTemplate,
    current: totalSteps === 0 ? 0 : resolvedStepIndex + 1,
    total: totalSteps,
  });

  if (!isControlLoading && activeQuestions.length === 0) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <h2 className='es-type-title text-2xl'>{common.waiting.title}</h2>
        <p className='es-text-body text-base'>{common.waiting.description}</p>
      </section>
    );
  }

  if (isControlLoading || !currentQuestion) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <p className='es-text-body text-base'>{common.waiting.description}</p>
      </section>
    );
  }

  if (isComplete) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <h2 className='es-type-title text-2xl'>{common.completion.title}</h2>
        <p className='es-text-body text-base'>{common.completion.description}</p>
      </section>
    );
  }

  const isFirstStep = resolvedStepIndex === 0;
  const isLastStep = resolvedStepIndex === totalSteps - 1;
  const showingFeedback = stepPhase === 'feedback' && currentQuestion.showAnswer;
  const showingLiveResults =
    stepPhase === 'liveResults' && currentQuestion.showResults;
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
        <PollAnswerPanel
          question={currentQuestion}
          common={common}
          answer={currentAnswer}
        />
      ) : null}
      {showingLiveResults ? (
        <PollLiveResultsPanel
          pollSlug={poll.slug}
          question={currentQuestion}
          common={common}
        />
      ) : null}
      {!onInterstitial ? (
        <PollQuestionField
          question={currentQuestion}
          common={common}
          answer={currentAnswer}
          onAnswerChange={(patch) => updateAnswerState(currentQuestion.id, patch)}
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
            onClick={() => {
              setErrorMessage(null);
              setStepIndex((index) => Math.max(0, Math.min(index, activeQuestions.length - 1) - 1));
              setStepPhase('answer');
            }}
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

  async function handlePrimaryAction(): Promise<void> {
    setErrorMessage(null);

    if (onInterstitial) {
      if (showingFeedback && currentQuestion.showResults) {
        setStepPhase('liveResults');
        return;
      }
      advanceToNextQuestion();
      return;
    }

    const validationError = validateAnswer(currentQuestion, currentAnswer, common);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await persistPollAnswer({
        pollSlug: poll.slug,
        sessionId,
        question: currentQuestion,
        answer: currentAnswer,
      });
    } catch (error) {
      setErrorMessage(resolvePersistErrorMessage(error, common));
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    if (currentQuestion.showAnswer) {
      setStepPhase('feedback');
      return;
    }

    if (currentQuestion.showResults) {
      setStepPhase('liveResults');
      return;
    }

    if (isLastStep) {
      setIsComplete(true);
      return;
    }
    advanceToNextQuestion();
  }

  function advanceToNextQuestion(): void {
    if (isLastStep) {
      setIsComplete(true);
      return;
    }
    setStepIndex((index) => Math.min(index + 1, activeQuestions.length - 1));
    setStepPhase('answer');
  }
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
