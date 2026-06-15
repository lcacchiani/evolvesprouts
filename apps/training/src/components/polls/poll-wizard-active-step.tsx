'use client';

import { useState } from 'react';

import {
  isAnswerValid,
  type QuestionAnswerState,
} from '@/components/polls/poll-answer-state';
import { PollAnswerPanel } from '@/components/polls/poll-answer-panel';
import { PollLiveResultsPanel } from '@/components/polls/poll-live-results-panel';
import { PollQuestionField } from '@/components/polls/poll-question-field';
import type { PollContent, PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { PollApiError, persistPollAnswer } from '@/lib/polls-api';

type StepPhase = 'answer' | 'feedback' | 'liveResults';

export interface PollWizardActiveStepProps {
  poll: PollContent;
  common: PollsCommonContent;
  sessionId: string;
  activeQuestions: PollQuestion[];
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
  onResyncControl: () => Promise<void>;
}

export function PollWizardActiveStep({
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
  onResyncControl,
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
      <p className='es-text-muted text-sm' aria-label={progressLabel}>
        {progressLabel}
      </p>
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
      finishQuestionStep();
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
      if (error instanceof PollApiError && (error.statusCode === 409 || error.statusCode === 403)) {
        await onResyncControl();
      }
      onErrorMessage(resolvePersistErrorMessage(error, common));
      onSavingChange(false);
      return;
    }
    onSavingChange(false);

    if (question.showAnswer) {
      setStepPhase('feedback');
      return;
    }

    if (question.showResults) {
      setStepPhase('liveResults');
      return;
    }

    finishQuestionStep();
  }

  function finishQuestionStep(): void {
    onPersistSuccess();
    if (!isLastStep) {
      onAdvance();
    }
  }
}

function resolvePersistErrorMessage(
  error: unknown,
  common: PollsCommonContent,
): string {
  if (error instanceof PollApiError) {
    if (error.statusCode === 0) {
      return common.errors.missingApiConfig;
    }
    if (error.errorCode === 'question_not_open') {
      return common.errors.questionClosed;
    }
    if (error.errorCode === 'poll_not_accepting_answers') {
      return common.errors.pollNotAccepting;
    }
    if (error.statusCode === 409 || error.statusCode === 403) {
      return common.errors.questionClosed;
    }
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
