'use client';

import { useMemo, useState } from 'react';

import {
  emptyAnswerState,
  isAnswerValid,
  type QuestionAnswerState,
} from '@/components/polls/poll-answer-state';
import { PollQuestionField } from '@/components/polls/poll-question-field';
import { PollResultsPanel } from '@/components/polls/poll-results-panel';
import type { PollContent, PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { getOrCreatePollSessionId } from '@/lib/poll-session';
import { PollApiError, persistPollAnswer } from '@/lib/polls-api';

export interface PollWizardProps {
  poll: PollContent;
  common: PollsCommonContent;
}

type StepPhase = 'answer' | 'results';

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
  const totalSteps = poll.questions.length;
  const currentQuestion = poll.questions[stepIndex];
  const currentAnswer = currentQuestion
    ? (answersByQuestionId[currentQuestion.id] ?? emptyAnswerState())
    : emptyAnswerState();

  const progressLabel = formatProgressLabel({
    template: common.a11y.progressTemplate,
    current: Math.min(stepIndex + 1, totalSteps),
    total: totalSteps,
  });

  if (isComplete) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <h2 className='text-2xl font-semibold text-neutral-900'>{common.completion.title}</h2>
        <p className='text-base text-neutral-700'>{common.completion.description}</p>
      </section>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalSteps - 1;
  const showingResults = stepPhase === 'results' && currentQuestion.showResults;
  const primaryLabel = resolvePrimaryLabel({
    common,
    isLastStep,
    showingResults,
  });

  return (
    <section className='mx-auto flex w-full max-w-xl flex-col gap-6'>
      <p className='text-sm text-neutral-600'>{progressLabel}</p>
      {showingResults ? (
        <PollResultsPanel
          question={currentQuestion}
          common={common}
          answer={currentAnswer}
        />
      ) : (
        <PollQuestionField
          question={currentQuestion}
          common={common}
          answer={currentAnswer}
          onAnswerChange={(patch) => updateAnswerState(currentQuestion.id, patch)}
        />
      )}
      {errorMessage ? (
        <p className='text-sm text-red-700' role='alert'>
          {errorMessage}
        </p>
      ) : null}
      <div className='flex flex-wrap items-center justify-start gap-2'>
        {!isFirstStep && !showingResults ? (
          <button
            type='button'
            className='rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900'
            disabled={isSaving}
            onClick={() => {
              setErrorMessage(null);
              setStepIndex((index) => Math.max(0, index - 1));
              setStepPhase('answer');
            }}
          >
            {common.navigation.back}
          </button>
        ) : null}
        <button
          type='button'
          className='rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60'
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

    if (showingResults) {
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

    if (currentQuestion.showResults) {
      setStepPhase('results');
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
    setStepIndex((index) => index + 1);
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
  showingResults,
}: {
  common: PollsCommonContent;
  isLastStep: boolean;
  showingResults: boolean;
}): string {
  if (showingResults) {
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
