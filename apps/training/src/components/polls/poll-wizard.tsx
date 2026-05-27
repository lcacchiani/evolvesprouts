'use client';

import { useMemo, useState } from 'react';

import { PollQuestionField } from '@/components/polls/poll-question-field';
import type { PollContent, PollQuestion, PollsCommonContent } from '@/content/poll-types';
import { POLL_OTHER_ANSWER_ID } from '@/content/poll-types';
import { getOrCreatePollSessionId } from '@/lib/poll-session';
import { persistPollAnswer } from '@/lib/polls-api';

export interface PollWizardProps {
  poll: PollContent;
  common: PollsCommonContent;
}

export function PollWizard({ poll, common }: PollWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
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

  return (
    <section className='mx-auto flex w-full max-w-xl flex-col gap-6'>
      <p className='text-sm text-neutral-600'>{progressLabel}</p>
      <PollQuestionField
        question={currentQuestion}
        common={common}
        selectedAnswerIds={currentAnswer.selectedAnswerIds}
        otherText={currentAnswer.otherText}
        freeText={currentAnswer.freeText}
        onSelectedAnswerIdsChange={(value) => {
          updateAnswerState(currentQuestion.id, { selectedAnswerIds: value });
        }}
        onOtherTextChange={(value) => {
          updateAnswerState(currentQuestion.id, { otherText: value });
        }}
        onFreeTextChange={(value) => {
          updateAnswerState(currentQuestion.id, { freeText: value });
        }}
      />
      {errorMessage ? (
        <p className='text-sm text-red-700' role='alert'>
          {errorMessage}
        </p>
      ) : null}
      <div className='flex flex-wrap items-center justify-start gap-2'>
        {!isFirstStep ? (
          <button
            type='button'
            className='rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900'
            disabled={isSaving}
            onClick={() => {
              setErrorMessage(null);
              setStepIndex((index) => Math.max(0, index - 1));
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
          {isLastStep ? common.navigation.finish : common.navigation.next}
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
    if (!isAnswerValid(currentQuestion, currentAnswer)) {
      setErrorMessage(common.errors.required);
      return;
    }

    setIsSaving(true);
    try {
      await persistPollAnswer({
        pollSlug: poll.slug,
        sessionId,
        question: currentQuestion,
        selectedAnswerIds: currentAnswer.selectedAnswerIds,
        otherText: currentAnswer.otherText,
        freeText: currentAnswer.freeText,
      });
    } catch {
      setErrorMessage(common.errors.persistFailed);
      setIsSaving(false);
      return;
    }
    setIsSaving(false);

    if (isLastStep) {
      setIsComplete(true);
      return;
    }
    setStepIndex((index) => index + 1);
  }
}

interface QuestionAnswerState {
  selectedAnswerIds: string[];
  otherText: string;
  freeText: string;
}

function emptyAnswerState(): QuestionAnswerState {
  return {
    selectedAnswerIds: [],
    otherText: '',
    freeText: '',
  };
}

function isAnswerValid(
  question: PollQuestion,
  answer: QuestionAnswerState,
): boolean {
  if (question.type === 'text') {
    return answer.freeText.trim().length > 0;
  }

  const selected = answer.selectedAnswerIds;
  if (selected.length === 0) {
    return false;
  }
  if (question.selectionMode === 'single' && selected.length > 1) {
    return false;
  }
  if (selected.includes(POLL_OTHER_ANSWER_ID) && !answer.otherText.trim()) {
    return false;
  }
  const predefined = selected.filter((id) => id !== POLL_OTHER_ANSWER_ID);
  return predefined.length > 0 || selected.includes(POLL_OTHER_ANSWER_ID);
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
