'use client';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import type { QuestionAnswerState } from '@/components/polls/poll-answer-state';
import { slugifyOption } from '@/lib/slugify-option';

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
        <fieldset aria-labelledby={headingId} className='flex flex-wrap gap-2'>
          <label
            htmlFor={`${question.id}-true`}
            className={`poll-option-label flex cursor-pointer items-center gap-2 rounded-inner border px-4 py-2 es-bg-surface-white ${answer.trueFalseValue === true ? 'poll-option-label--selected' : ''}`}
          >
            <input
              id={`${question.id}-true`}
              type='radio'
              name={question.id}
              className='es-accent-brand es-focus-ring h-4 w-4 shrink-0'
              checked={answer.trueFalseValue === true}
              onChange={() => onAnswerChange({ trueFalseValue: true })}
            />
            <span className='es-text-body text-base'>{common.truefalse.trueLabel}</span>
          </label>
          <label
            htmlFor={`${question.id}-false`}
            className={`poll-option-label flex cursor-pointer items-center gap-2 rounded-inner border px-4 py-2 es-bg-surface-white ${answer.trueFalseValue === false ? 'poll-option-label--selected' : ''}`}
          >
            <input
              id={`${question.id}-false`}
              type='radio'
              name={question.id}
              className='es-accent-brand es-focus-ring h-4 w-4 shrink-0'
              checked={answer.trueFalseValue === false}
              onChange={() => onAnswerChange({ trueFalseValue: false })}
            />
            <span className='es-text-body text-base'>{common.truefalse.falseLabel}</span>
          </label>
        </fieldset>
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
