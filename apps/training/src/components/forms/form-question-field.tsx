'use client';

import type { FormQuestion, FormsCommonContent } from '@/content/form-types';
import type { FormAnswerState } from '@/components/forms/form-answer-state';
import { toggleMultiselectOption } from '@/components/forms/form-answer-state';

export interface FormQuestionFieldProps {
  question: FormQuestion;
  common: FormsCommonContent;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
  variant?: 'wizard' | 'scroll';
}

export function FormQuestionField({
  question,
  common,
  answer,
  onAnswerChange,
  variant = 'wizard',
}: FormQuestionFieldProps) {
  const headingId = `${question.id}-heading`;
  const isScroll = variant === 'scroll';

  return (
    <div className={`flex w-full flex-col ${isScroll ? 'gap-3' : 'gap-4'}`}>
      <div className='flex flex-col gap-1'>
        {question.screen ? <p className='es-type-eyebrow'>{question.screen}</p> : null}
        <h2
          id={headingId}
          className={
            isScroll
              ? 'form-scroll-question text-lg font-bold'
              : 'es-text-heading text-xl font-semibold'
          }
        >
          {question.number !== undefined ? (
            <span className='form-scroll-question-number'>{question.number}. </span>
          ) : null}
          {question.question}
        </h2>
        {question.hint ? (
          <p className={isScroll ? 'form-scroll-hint text-sm' : 'es-text-muted text-sm'}>
            {question.hint}
          </p>
        ) : null}
      </div>
      {question.type === 'rating' ? (
        <RatingField
          question={question}
          headingId={headingId}
          common={common}
          answer={answer}
          onAnswerChange={onAnswerChange}
        />
      ) : null}
      {question.type === 'multiselect' ? (
        <MultiselectField
          question={question}
          headingId={headingId}
          common={common}
          answer={answer}
          onAnswerChange={onAnswerChange}
          isScroll={isScroll}
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
          headingId={headingId}
          common={common}
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
          className={`es-focus-ring es-form-input w-full ${isScroll ? 'form-scroll-textarea min-h-[4.5rem]' : 'min-h-28'}`}
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

function RatingField({
  question,
  headingId,
  common,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'rating' }>;
  headingId: string;
  common: FormsCommonContent;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  const groupLabel = common.a11y.ratingGroupTemplate.replace('{question}', question.question);

  return (
    <div className='flex flex-col gap-2'>
      <div
        role='radiogroup'
        aria-labelledby={headingId}
        aria-label={groupLabel}
        className='form-rating-row'
      >
        {question.options.map((option) => {
          const isSelected = answer.ratingValue === option.value;
          return (
            <button
              key={option.value}
              type='button'
              role='radio'
              aria-checked={isSelected}
              aria-label={option.ariaLabel ?? `Rating ${option.value}`}
              className={`form-rating-option es-focus-ring ${isSelected ? 'form-rating-option--selected' : ''}`}
              onClick={() => onAnswerChange({ ratingValue: option.value })}
            >
              <span aria-hidden='true'>{option.emoji}</span>
            </button>
          );
        })}
      </div>
      {question.minLabel || question.maxLabel ? (
        <div className='form-rating-labels'>
          <span>{question.minLabel ?? ''}</span>
          <span>{question.maxLabel ?? ''}</span>
        </div>
      ) : null}
    </div>
  );
}

function MultiselectField({
  question,
  headingId,
  common,
  answer,
  onAnswerChange,
  isScroll,
}: {
  question: Extract<FormQuestion, { type: 'multiselect' }>;
  headingId: string;
  common: FormsCommonContent;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
  isScroll: boolean;
}) {
  const atMax = answer.selectedOptions.length >= question.maxSelections;

  if (isScroll) {
    return (
      <div
        role='group'
        aria-labelledby={headingId}
        className='form-chip-row'
      >
        {question.options.map((option) => {
          const isSelected = answer.selectedOptions.includes(option);
          const isLocked = atMax && !isSelected;
          return (
            <button
              key={option}
              type='button'
              aria-pressed={isSelected}
              disabled={isLocked}
              aria-label={
                isLocked
                  ? `${option} (${common.multiselect.lockedAriaLabel})`
                  : option
              }
              className={`form-chip es-focus-ring ${isSelected ? 'form-chip--selected' : ''} ${isLocked ? 'form-chip--locked' : ''}`}
              onClick={() =>
                onAnswerChange({
                  selectedOptions: toggleMultiselectOption(
                    answer.selectedOptions,
                    option,
                    question.maxSelections,
                  ),
                })
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

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
    <div role='radiogroup' aria-labelledby={headingId} className='form-segmented-row'>
      {question.options.map((option) => {
        const isSelected = answer.selectedOption === option.value;
        const variantClass = option.variant ? `form-segmented-option--${option.variant}` : '';
        return (
          <button
            key={option.value}
            type='button'
            role='radio'
            aria-checked={isSelected}
            className={`form-segmented-option es-focus-ring ${variantClass} ${isSelected ? 'form-segmented-option--selected' : ''}`}
            onClick={() => onAnswerChange({ selectedOption: option.value })}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ConsentField({
  question,
  headingId,
  common,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'consent' }>;
  headingId: string;
  common: FormsCommonContent;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  const isChecked = answer.trueFalseValue === true;
  const showFollowUp = Boolean(question.followUp) && isChecked;

  return (
    <div className='flex flex-col gap-3'>
      <button
        type='button'
        className='form-consent-row es-focus-ring'
        aria-labelledby={headingId}
        aria-pressed={isChecked}
        onClick={() =>
          onAnswerChange({
            trueFalseValue: !isChecked,
            freeText: !isChecked ? answer.freeText : '',
          })
        }
      >
        <span
          className={`form-consent-checkbox ${isChecked ? 'form-consent-checkbox--checked' : ''}`}
          aria-hidden='true'
        >
          {isChecked ? <span className='form-consent-checkmark'>✓</span> : null}
        </span>
        <span className='form-consent-text text-left text-sm leading-snug'>
          {question.consentText}
        </span>
      </button>
      {showFollowUp && question.followUp ? (
        <input
          type='text'
          className='es-focus-ring es-form-input w-full'
          aria-label={common.a11y.consentCheckboxLabel}
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
