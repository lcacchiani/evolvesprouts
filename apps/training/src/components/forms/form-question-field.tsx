'use client';

import type { FormQuestion } from '@/content/form-types';
import type { FormAnswerState } from '@/components/forms/form-answer-state';

export interface FormQuestionFieldProps {
  question: FormQuestion;
  answer: FormAnswerState;
  onAnswerChange: (patch: Partial<FormAnswerState>) => void;
}

export function FormQuestionField({
  question,
  answer,
  onAnswerChange,
}: FormQuestionFieldProps) {
  return (
    <div className='flex w-full flex-col gap-4'>
      <div className='flex flex-col gap-1'>
        <p className='es-type-eyebrow'>{question.screen}</p>
        <h2 className='es-text-heading text-xl font-semibold'>{question.question}</h2>
      </div>
      {question.type === 'select' ? (
        <fieldset className='flex flex-col gap-2'>
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
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
      {question.type === 'email' ? (
        <input
          type='email'
          autoComplete='email'
          className='es-focus-ring es-form-input w-full'
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
