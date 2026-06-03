'use client';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import type { QuestionAnswerState } from '@/components/polls/poll-answer-state';

export interface PollQuestionFieldProps {
  question: PollQuestion;
  common: PollsCommonContent;
  answer: QuestionAnswerState;
  onAnswerChange: (patch: Partial<QuestionAnswerState>) => void;
}

export function PollQuestionField({
  question,
  common,
  answer,
  onAnswerChange,
}: PollQuestionFieldProps) {
  const headingId = `${question.id}-heading`;

  return (
    <div className='flex w-full flex-col gap-4'>
      <div className='flex flex-col gap-1'>
        <p className='es-type-eyebrow'>{question.screen}</p>
        <h2 id={headingId} className='es-text-heading text-xl font-semibold'>
          {question.question}
        </h2>
      </div>
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
      {question.type === 'multiselect' ? (
        <fieldset aria-labelledby={headingId} className='flex flex-col gap-2'>
          {question.options.map((option) => {
            const inputId = `${question.id}-${slugifyOption(option)}`;
            const isSelected = answer.selectedOptions.includes(option);
            return (
              <label
                key={option}
                htmlFor={inputId}
                className={`poll-option-label flex cursor-pointer items-start gap-3 rounded-inner border px-3 py-2 es-bg-surface-white ${isSelected ? 'poll-option-label--selected' : ''}`}
              >
                <input
                  id={inputId}
                  type='checkbox'
                  name={question.id}
                  className='es-accent-brand es-focus-ring mt-1 h-4 w-4 shrink-0'
                  checked={isSelected}
                  onChange={() =>
                    onAnswerChange({
                      selectedOptions: toggleMultiselectOption(
                        answer.selectedOptions,
                        option,
                        question.exclusiveOption,
                      ),
                    })
                  }
                />
                <span className='es-text-body text-base'>{option}</span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {question.type === 'truefalse' ? (
        <div
          role='radiogroup'
          aria-labelledby={headingId}
          className='flex flex-wrap gap-2'
        >
          <button
            type='button'
            role='radio'
            aria-checked={answer.trueFalseValue === true}
            className={trueFalseButtonClass(answer.trueFalseValue === true)}
            onClick={() => onAnswerChange({ trueFalseValue: true })}
          >
            {common.truefalse.trueLabel}
          </button>
          <button
            type='button'
            role='radio'
            aria-checked={answer.trueFalseValue === false}
            className={trueFalseButtonClass(answer.trueFalseValue === false)}
            onClick={() => onAnswerChange({ trueFalseValue: false })}
          >
            {common.truefalse.falseLabel}
          </button>
        </div>
      ) : null}
      {question.type === 'text' ? (
        <textarea
          className='es-focus-ring es-form-input min-h-28 w-full'
          aria-labelledby={headingId}
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
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
    </div>
  );
}

function trueFalseButtonClass(isSelected: boolean): string {
  const base = 'es-btn es-btn--selection es-focus-ring px-4 py-2 text-sm';
  return isSelected
    ? `${base} es-btn--state-active`
    : `${base} es-btn--state-inactive`;
}

function slugifyOption(option: string): string {
  return option
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toggleMultiselectOption(
  current: string[],
  option: string,
  exclusiveOption?: string,
): string[] {
  const isSelected = current.includes(option);
  if (isSelected) {
    return current.filter((value) => value !== option);
  }
  if (exclusiveOption && option === exclusiveOption) {
    return [option];
  }
  if (exclusiveOption) {
    return [...current.filter((value) => value !== exclusiveOption), option];
  }
  return [...current, option];
}
