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
                className={`flex cursor-pointer items-start gap-3 rounded-inner border px-3 py-2 es-border-panel-soft es-bg-surface-white ${answer.selectedOption === option ? 'es-border-panel' : ''}`}
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
      {question.type === 'truefalse' ? (
        <div className='flex flex-wrap gap-2'>
          <button
            type='button'
            className={trueFalseButtonClass(answer.trueFalseValue === true)}
            onClick={() => onAnswerChange({ trueFalseValue: true })}
          >
            {common.truefalse.trueLabel}
          </button>
          <button
            type='button'
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
