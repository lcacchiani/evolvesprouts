'use client';

import { useMemo, useState } from 'react';

import {
  emptyFormAnswerState,
  isFormAnswerValid,
  type FormAnswerState,
} from '@/components/forms/form-answer-state';
import { FormQuestionField } from '@/components/forms/form-question-field';
import type { FormContent, FormQuestion, FormsCommonContent } from '@/content/form-types';
import { getOrCreateFormSessionId } from '@/lib/form-session';
import { FormApiError, persistFormAnswer } from '@/lib/forms-api';

export interface FormWizardProps {
  form: FormContent;
  common: FormsCommonContent;
}

export function FormWizard({ form, common }: FormWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<
    Record<string, FormAnswerState>
  >({});

  const sessionId = useMemo(() => getOrCreateFormSessionId(form.slug), [form.slug]);
  const questions = form.questions;
  const totalSteps = questions.length;
  const resolvedStepIndex = totalSteps === 0 ? 0 : Math.min(stepIndex, totalSteps - 1);
  const currentQuestion = questions[resolvedStepIndex];
  const currentAnswer = currentQuestion
    ? (answersByQuestionId[currentQuestion.id] ?? emptyFormAnswerState())
    : emptyFormAnswerState();

  const progressLabel = formatProgressLabel({
    template: common.a11y.progressTemplate,
    current: totalSteps === 0 ? 0 : resolvedStepIndex + 1,
    total: totalSteps,
  });

  if (isComplete || totalSteps === 0) {
    return (
      <section className='mx-auto flex w-full max-w-xl flex-col gap-3 text-center'>
        <h2 className='es-type-title text-2xl'>{common.completion.title}</h2>
        <p className='es-text-body text-base'>{common.completion.description}</p>
      </section>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  const isFirstStep = resolvedStepIndex === 0;
  const isLastStep = resolvedStepIndex === totalSteps - 1;
  const primaryLabel = isLastStep ? common.navigation.finish : common.navigation.next;

  return (
    <section className='mx-auto flex w-full max-w-xl flex-col gap-6'>
      <p className='es-text-muted text-sm'>{progressLabel}</p>
      <FormQuestionField
        question={currentQuestion}
        answer={currentAnswer}
        onAnswerChange={(patch) => updateAnswerState(currentQuestion.id, patch)}
      />
      {errorMessage ? (
        <p className='es-text-danger text-sm' role='alert'>
          {errorMessage}
        </p>
      ) : null}
      <div className='flex flex-wrap items-center justify-start gap-2'>
        {!isFirstStep ? (
          <button
            type='button'
            className='es-btn es-btn--primary es-btn--outline es-focus-ring'
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
          className='es-btn es-btn--primary es-focus-ring'
          disabled={isSaving}
          onClick={() => void handlePrimaryAction()}
        >
          {primaryLabel}
        </button>
      </div>
    </section>
  );

  function updateAnswerState(questionId: string, patch: Partial<FormAnswerState>): void {
    setAnswersByQuestionId((previous) => ({
      ...previous,
      [questionId]: {
        ...emptyFormAnswerState(),
        ...previous[questionId],
        ...patch,
      },
    }));
  }

  async function handlePrimaryAction(): Promise<void> {
    setErrorMessage(null);

    const validationError = validateAnswer(currentQuestion, currentAnswer, common);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      await persistFormAnswer({
        formSlug: form.slug,
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

    if (isLastStep) {
      setIsComplete(true);
      return;
    }
    setStepIndex((index) => Math.min(index + 1, totalSteps - 1));
  }
}

function resolvePersistErrorMessage(error: unknown, common: FormsCommonContent): string {
  if (error instanceof FormApiError && error.statusCode === 0) {
    return common.errors.missingApiConfig;
  }
  return common.errors.persistFailed;
}

function validateAnswer(
  question: FormQuestion,
  answer: FormAnswerState,
  common: FormsCommonContent,
): string | null {
  if (!isFormAnswerValid(question, answer)) {
    if (question.type === 'email') {
      return common.errors.invalidEmail;
    }
    return common.errors.required;
  }
  return null;
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
