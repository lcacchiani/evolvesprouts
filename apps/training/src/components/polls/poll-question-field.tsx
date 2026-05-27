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
        <p className='text-sm font-medium uppercase tracking-wide text-neutral-600'>
          {question.screen}
        </p>
        <h2 className='text-xl font-semibold text-neutral-900'>{question.question}</h2>
      </div>
      {question.type === 'select' ? (
        <fieldset className='flex flex-col gap-2'>
          {question.options.map((option) => {
            const inputId = `${question.id}-${slugifyOption(option)}`;
            return (
              <label
                key={option}
                htmlFor={inputId}
                className='flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2'
              >
                <input
                  id={inputId}
                  type='radio'
                  name={question.id}
                  className='mt-1 h-4 w-4 shrink-0'
                  checked={answer.selectedOption === option}
                  onChange={() => onAnswerChange({ selectedOption: option })}
                />
                <span className='text-base text-neutral-900'>{option}</span>
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
          className='min-h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900'
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
      {question.type === 'email' ? (
        <input
          type='email'
          autoComplete='email'
          className='w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900'
          value={answer.freeText}
          onChange={(event) => onAnswerChange({ freeText: event.target.value })}
        />
      ) : null}
    </div>
  );
}

function trueFalseButtonClass(isSelected: boolean): string {
  const base =
    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors';
  if (isSelected) {
    return `${base} border-neutral-900 bg-neutral-900 text-white`;
  }
  return `${base} border-neutral-300 bg-white text-neutral-900`;
}

function slugifyOption(option: string): string {
  return option
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
