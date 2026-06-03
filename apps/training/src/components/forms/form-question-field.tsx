'use client';

import type { FormQuestion, FormsCommonContent } from '@/content/form-types';
import { isQuestionRequired } from '@/content/form-types';
import type { FormAnswerState } from '@/components/forms/form-answer-state';
import { toggleMultiselectOption } from '@/components/forms/form-answer-state';

export interface FormQuestionFieldProps {
  question: FormQuestion;
  common: FormsCommonContent;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
  variant?: 'wizard' | 'scroll';
  /** 1-based display index for scroll layout (derived from question order). */
  displayNumber?: number;
}

export function FormQuestionField({
  question,
  common,
  answer,
  onAnswerChange,
  variant = 'wizard',
  displayNumber,
}: FormQuestionFieldProps) {
  const headingId = `${question.id}-heading`;
  const isScroll = variant === 'scroll';
  const required = isQuestionRequired(question);
  const numberPrefix =
    displayNumber !== undefined
      ? displayNumber
      : question.number !== undefined
        ? question.number
        : undefined;

  const resolvedHint = resolveQuestionHint(question, common);

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
          {numberPrefix !== undefined ? (
            <span className='form-scroll-question-number'>{numberPrefix}. </span>
          ) : null}
          {question.question}
          {required && isScroll ? (
            <span className='form-scroll-required-marker text-sm font-medium'>
              {' '}
              ({common.scroll.requiredMarker})
            </span>
          ) : null}
        </h2>
        {resolvedHint ? (
          <p className={isScroll ? 'form-scroll-hint text-sm' : 'es-text-muted text-sm'}>
            {resolvedHint}
          </p>
        ) : null}
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
    <fieldset aria-labelledby={headingId} className='flex flex-col gap-2 border-0 p-0'>
      <div className='form-rating-row'>
        {question.options.map((option) => {
          const isSelected = answer.ratingValue === option.value;
          const inputId = `${question.id}-rating-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={inputId}
              className={`form-rating-option ${isSelected ? 'form-rating-option--selected' : ''}`}
            >
              <input
                id={inputId}
                type='radio'
                name={`${question.id}-rating`}
                className='sr-only'
                checked={isSelected}
                value={option.value}
                onChange={() => onAnswerChange({ ratingValue: option.value })}
              />
              <span aria-hidden='true'>{option.emoji}</span>
              <span className='sr-only'>{option.ariaLabel ?? `Rating ${option.value}`}</span>
            </label>
          );
        })}
      </div>
      {question.minLabel || question.maxLabel ? (
        <div className='form-rating-labels'>
          <span>{question.minLabel ?? ''}</span>
          <span>{question.maxLabel ?? ''}</span>
        </div>
      ) : null}
    </fieldset>
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
      <div role='group' aria-labelledby={headingId} className='form-chip-row'>
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
    <fieldset aria-labelledby={headingId} className='form-segmented-row border-0 p-0'>
      {question.options.map((option) => {
        const isSelected = answer.selectedOption === option.value;
        const variantClass = option.variant ? `form-segmented-option--${option.variant}` : '';
        const inputId = `${question.id}-segmented-${slugifyOption(option.value)}`;
        return (
          <label
            key={option.value}
            htmlFor={inputId}
            className={`form-segmented-option ${variantClass} ${isSelected ? 'form-segmented-option--selected' : ''}`}
          >
            <input
              id={inputId}
              type='radio'
              name={`${question.id}-segmented`}
              className='sr-only'
              checked={isSelected}
              value={option.value}
              onChange={() => onAnswerChange({ selectedOption: option.value })}
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

function ConsentField({
  question,
  headingId,
  answer,
  onAnswerChange,
}: {
  question: Extract<FormQuestion, { type: 'consent' }>;
  headingId: string;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}) {
  const isChecked = answer.trueFalseValue === true;
  const showFollowUp = Boolean(question.followUp) && isChecked;
  const consentTextId = `${question.id}-consent-text`;

  return (
    <div className='flex flex-col gap-3'>
      <button
        type='button'
        className='form-consent-row es-focus-ring'
        aria-labelledby={`${headingId} ${consentTextId}`}
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
        <span
          id={consentTextId}
          className='form-consent-text text-left text-sm leading-snug'
        >
          {question.consentText}
        </span>
      </button>
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
