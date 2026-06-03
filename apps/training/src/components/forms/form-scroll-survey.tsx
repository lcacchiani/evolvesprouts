'use client';

import { useMemo, useState } from 'react';

import {
  emptyFormAnswerState,
  isFormAnswerValid,
  type FormAnswerState,
} from '@/components/forms/form-answer-state';
import { FormQuestionField } from '@/components/forms/form-question-field';
import type { FormContent, FormQuestion, FormsCommonContent } from '@/content/form-types';
import { isQuestionRequired } from '@/content/form-types';
import { getOrCreateFormSessionId } from '@/lib/form-session';
import { FormApiError, persistFormAnswer } from '@/lib/forms-api';

export interface FormScrollSurveyProps {
  form: FormContent;
  common: FormsCommonContent;
}

export function FormScrollSurvey({ form, common }: FormScrollSurveyProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<
    Record<string, FormAnswerState>
  >({});

  const sessionId = useMemo(() => getOrCreateFormSessionId(form.slug), [form.slug]);
  const questions = form.questions;

  const canSubmit = useMemo(() => {
    return questions
      .filter((question) => isQuestionRequired(question))
      .every((question) =>
        isFormAnswerValid(question, answersByQuestionId[question.id] ?? emptyFormAnswerState()),
      );
  }, [answersByQuestionId, questions]);

  if (isComplete) {
    return (
      <section className='form-scroll-thanks flex flex-col items-center gap-4 text-center'>
        <p className='text-5xl' aria-hidden='true'>
          🌱
        </p>
        <h2 className='form-scroll-thanks-title text-2xl font-bold'>{common.completion.title}</h2>
        <p className='es-text-body max-w-sm text-base leading-relaxed'>
          {form.completion?.description ?? common.completion.description}
        </p>
        {form.completion?.allowAnother ? (
          <button
            type='button'
            className='form-scroll-again es-focus-ring'
            onClick={() => {
              setAnswersByQuestionId({});
              setIsComplete(false);
              setErrorMessage(null);
            }}
          >
            {form.completion.anotherLabel ?? common.scroll.submitAnotherLabel}
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className='mx-auto flex w-full max-w-[30rem] flex-col gap-4'>
      {form.intro ? (
        <div className='flex flex-col gap-2 text-center'>
          {form.intro.partnerName ? (
            <p className='form-scroll-brand text-sm font-semibold'>
              <span className='form-scroll-brand-primary'>Evolve Sprouts</span>
              <span className='form-scroll-brand-separator'>
                {common.scroll.brandPartnerSeparator}
              </span>
              <span>{form.intro.partnerName}</span>
            </p>
          ) : null}
          <p className='form-scroll-subtitle text-sm leading-snug'>{form.intro.subtitle}</p>
          <p className='form-scroll-duration text-xs font-bold uppercase tracking-wide'>
            ⏱ {form.intro.durationLabel}
          </p>
        </div>
      ) : null}

      {questions.map((question) => (
        <article key={question.id} className='form-scroll-card rounded-2xl border p-4'>
          <FormQuestionField
            question={question}
            common={common}
            variant='scroll'
            answer={answersByQuestionId[question.id] ?? emptyFormAnswerState()}
            onAnswerChange={(patch) => updateAnswerState(question.id, patch)}
          />
        </article>
      ))}

      {errorMessage ? (
        <p className='es-text-danger text-sm' role='alert'>
          {errorMessage}
        </p>
      ) : null}

      <button
        type='button'
        className='form-scroll-submit es-focus-ring w-full'
        disabled={!canSubmit || isSaving}
        onClick={() => void handleSubmit()}
      >
        {common.scroll.submitLabel}
      </button>
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

  async function handleSubmit(): Promise<void> {
    setErrorMessage(null);

    const validationError = findFirstValidationError(questions, answersByQuestionId, common);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      for (const question of questions) {
        const answer = answersByQuestionId[question.id] ?? emptyFormAnswerState();
        if (!shouldPersistAnswer(question, answer)) {
          continue;
        }
        await persistFormAnswer({
          formSlug: form.slug,
          sessionId,
          question,
          answer,
        });
      }
    } catch (error) {
      setErrorMessage(resolvePersistErrorMessage(error, common));
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    setIsComplete(true);
  }
}

function shouldPersistAnswer(question: FormQuestion, answer: FormAnswerState): boolean {
  if (question.type === 'multiselect') {
    return answer.selectedOptions.length > 0;
  }
  if (question.type === 'text' || question.type === 'email') {
    return answer.freeText.trim().length > 0;
  }
  if (question.type === 'consent') {
    return answer.trueFalseValue === true || isQuestionRequired(question);
  }
  return isFormAnswerValid(question, answer);
}

function findFirstValidationError(
  questions: FormQuestion[],
  answersByQuestionId: Record<string, FormAnswerState>,
  common: FormsCommonContent,
): string | null {
  for (const question of questions) {
    const answer = answersByQuestionId[question.id] ?? emptyFormAnswerState();
    if (!isFormAnswerValid(question, answer)) {
      if (question.type === 'email') {
        return common.errors.invalidEmail;
      }
      if (question.type === 'multiselect' && isQuestionRequired(question)) {
        return formatMaxSelectionsError(common, question.maxSelections);
      }
      return common.errors.required;
    }
  }
  return null;
}

function formatMaxSelectionsError(common: FormsCommonContent, max: number): string {
  return common.errors.maxSelectionsTemplate.replace('{max}', String(max));
}

function resolvePersistErrorMessage(error: unknown, common: FormsCommonContent): string {
  if (error instanceof FormApiError && error.statusCode === 0) {
    return common.errors.missingApiConfig;
  }
  return common.errors.persistFailed;
}
