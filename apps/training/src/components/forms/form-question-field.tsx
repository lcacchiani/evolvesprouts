'use client';

import type { FormQuestion, FormsCommonContent } from '@/content/form-types';
import type { FormAnswerState } from '@/components/forms/form-answer-state';
import { toggleMultiselectOption } from '@/components/forms/form-answer-state';

export interface FormQuestionFieldProps {
  question: FormQuestion;
  common: FormsCommonContent;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}

export function FormQuestionField({
  question,
  common,
  answer,
  onAnswerChange,
}: FormQuestionFieldProps) {
  const headingId = `${question.id}-heading`;
  const resolvedHint = resolveQuestionHint(question, common);

  return (
    <div className='flex w-full flex-col gap-4'>
      <div className='flex flex-col gap-1'>
        {question.screen ? <p className='es-type-eyebrow'>{question.screen}</p> : null}
        <h2 id={headingId} className='es-text-heading text-xl font-semibold'>
          {question.question}
        </h2>
        {resolvedHint ? <p className='es-text-muted text-sm'>{resolvedHint}</p> : null}
      </div>
      {question.type === 'rating' ? (
        <RatingField
          question={question}
          headingId={headingId}
          answer={answer}
          onAnswerChange={onAnswerChange}
        />
      ) : null}
      {question.type === 'multiselect' ? (
        <MultiselectField
          question={question}
          headingId={headingId}
          answer={answer}
          onAnswerChange={onAnswerChange}
        />
      ) : null}
      {question.type === 'segmented' ? (
        <SegmentedField
          question={question}
          headingId={headingId}
          answer={answer}
          onAnswerChange={onAnswerChange}
        />
      ) : null}
      {question.type === 'consent' ? (
        <ConsentField
          question={question}
          answer={answer}
          onAnswerChange={onAnswerChange}
        />
      ) : null}
      {question.type === 'select' ? (
        <fieldset aria-labelledby={headingId} className='flex flex-col gap-2'>
          {question.options.map((option) => {
            const inputId = `${question.id}-${slugifyOption(option)}`;
            return (
              <label
                key={option}
                htmlFor={inputId}
                className={`poll-option-label flex cursor-pointer items-start gap-3 rounded-inner border px-3 py-2 es-bg-surface-white ${answer.selectedOption === option ? 'poll-option-label--selected' : ''}`}
              >
                <input
                  id={inputId}
                  type='radio'
                  name={question.id}
                  className='es-accent-brand es-focus-ring mt-1 h-4 w-4 shrink-0'
                  checked={answer.selectedOption === option}
                  onChange={() => onAnswerChange({ selectedOption: option })}
                />
                <span className='es-text-body text-base'>{option}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {question.type === 'text' ? (
        <textarea
          className='es-focus-ring es-form-input min-h-28 w-full'
          aria-labelledby={headingId}
          placeholder={question.placeholder}
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
      {question.type === 'email' ? (
        <input
          type='email'
          autoComplete='email'
          className='es-focus-ring es-form-input w-full'
          aria-labelledby={headingId}
          placeholder={question.placeholder}
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
    </div>
  );
}

function resolveQuestionHint(question: FormQuestion, common: FormsCommonContent): string | undefined {
  if (question.hint) {
    return question.hint;
  }
  if (question.type === 'multiselect') {
    return common.multiselect.pickUpToTemplate.replace('{max}', String(question.maxSelections));
  }
  return undefined;
}

function RatingField({
  question,
  headingId,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'rating' }>;
  headingId: string;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  return (
    <fieldset aria-labelledby={headingId} className='flex flex-col gap-2'>
      {question.options.map((option) => {
        const isSelected = answer.ratingValue === option.value;
        const inputId = `${question.id}-rating-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className={`poll-option-label flex cursor-pointer items-center gap-3 rounded-inner border px-3 py-2 es-bg-surface-white ${isSelected ? 'poll-option-label--selected' : ''}`}
          >
            <input
              id={inputId}
              type='radio'
              name={`${question.id}-rating`}
              className='es-accent-brand es-focus-ring h-4 w-4 shrink-0'
              checked={isSelected}
              value={option.value}
              onChange={() => onAnswerChange({ ratingValue: option.value })}
            />
            <span className='text-xl' aria-hidden='true'>
              {option.emoji}
            </span>
            <span className='es-text-body text-base'>
              {option.ariaLabel ?? `Rating ${option.value}`}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

function MultiselectField({
  question,
  headingId,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'multiselect' }>;
  headingId: string;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  const atMax = answer.selectedOptions.length >= question.maxSelections;

  return (
    <fieldset aria-labelledby={headingId} className='flex flex-col gap-2'>
      {question.options.map((option) => {
        const inputId = `${question.id}-${slugifyOption(option)}`;
        const isSelected = answer.selectedOptions.includes(option);
        const isLocked = atMax && !isSelected;
        return (
          <label
            key={option}
            htmlFor={inputId}
            className={`poll-option-label flex cursor-pointer items-start gap-3 rounded-inner border px-3 py-2 es-bg-surface-white ${isSelected ? 'poll-option-label--selected' : ''} ${isLocked ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input
              id={inputId}
              type='checkbox'
              name={question.id}
              className='es-accent-brand es-focus-ring mt-1 h-4 w-4 shrink-0'
              checked={isSelected}
              disabled={isLocked}
              onChange={() =>
                onAnswerChange({
                  selectedOptions: toggleMultiselectOption(
                    answer.selectedOptions,
                    option,
                    question.maxSelections,
                  ),
                })
              }
            />
            <span className='es-text-body text-base'>{option}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function SegmentedField({
  question,
  headingId,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'segmented' }>;
  headingId: string;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  return (
    <fieldset aria-labelledby={headingId} className='flex flex-col gap-2'>
      {question.options.map((option) => {
        const isSelected = answer.selectedOption === option.value;
        const inputId = `${question.id}-segmented-${slugifyOption(option.value)}`;
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className={`poll-option-label flex cursor-pointer items-start gap-3 rounded-inner border px-3 py-2 es-bg-surface-white ${isSelected ? 'poll-option-label--selected' : ''}`}
          >
            <input
              id={inputId}
              type='radio'
              name={`${question.id}-segmented`}
              className='es-accent-brand es-focus-ring mt-1 h-4 w-4 shrink-0'
              checked={isSelected}
              value={option.value}
              onChange={() => onAnswerChange({ selectedOption: option.value })}
            />
            <span className='es-text-body text-base'>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function ConsentField({
  question,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'consent' }>;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  const isChecked = answer.trueFalseValue === true;
  const showFollowUp = Boolean(question.followUp) && isChecked;
  const inputId = `${question.id}-consent`;

  return (
    <div className='flex flex-col gap-3'>
      <label
        htmlFor={inputId}
        className={`poll-option-label flex cursor-pointer items-start gap-3 rounded-inner border px-3 py-2 es-bg-surface-white ${isChecked ? 'poll-option-label--selected' : ''}`}
      >
        <input
          id={inputId}
          type='checkbox'
          name={question.id}
          className='es-accent-brand es-focus-ring mt-1 h-4 w-4 shrink-0'
          checked={isChecked}
          onChange={() =>
            onAnswerChange({
              trueFalseValue: !isChecked,
              freeText: !isChecked ? answer.freeText : '',
            })
          }
        />
        <span className='es-text-body text-base'>{question.consentText}</span>
      </label>
      {showFollowUp && question.followUp ? (
        <input
          type='text'
          className='es-focus-ring es-form-input w-full'
          aria-label={question.followUp.placeholder}
          placeholder={question.followUp.placeholder}
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
    </div>
  );
}

function slugifyOption(option: string): string {
  return option
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
