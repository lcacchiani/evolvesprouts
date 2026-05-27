'use client';

import type { PollChoiceQuestion, PollQuestion } from '@/content/poll-types';
import { POLL_OTHER_ANSWER_ID, type PollsCommonContent } from '@/content/poll-types';

export interface PollQuestionFieldProps {
  question: PollQuestion;
  common: PollsCommonContent;
  selectedAnswerIds: string[];
  otherText: string;
  freeText: string;
  onSelectedAnswerIdsChange: (value: string[]) => void;
  onOtherTextChange: (value: string) => void;
  onFreeTextChange: (value: string) => void;
}

export function PollQuestionField({
  question,
  common,
  selectedAnswerIds,
  otherText,
  freeText,
  onSelectedAnswerIdsChange,
  onOtherTextChange,
  onFreeTextChange,
}: PollQuestionFieldProps) {
  if (question.type === 'text') {
    return (
      <label className='flex w-full flex-col gap-2'>
        <span className='text-base font-medium text-neutral-900'>{question.text}</span>
        <textarea
          className='min-h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900'
          value={freeText}
          onChange={(event) => onFreeTextChange(event.target.value)}
        />
      </label>
    );
  }

  return (
    <fieldset className='flex w-full flex-col gap-3'>
      <legend className='text-base font-medium text-neutral-900'>{question.text}</legend>
      <div className='flex flex-col gap-2'>
        {question.answers.map((answer) => (
          <ChoiceControl
            key={answer.id}
            question={question}
            inputId={`${question.id}-${answer.id}`}
            label={answer.text}
            value={answer.id}
            checked={selectedAnswerIds.includes(answer.id)}
            onChange={(checked) => {
              onSelectedAnswerIdsChange(
                toggleChoiceSelection({
                  question,
                  selectedAnswerIds,
                  value: answer.id,
                  checked,
                }),
              );
            }}
          />
        ))}
        {question.allowOther ? (
          <div className='flex flex-col gap-2'>
            <ChoiceControl
              question={question}
              inputId={`${question.id}-${POLL_OTHER_ANSWER_ID}`}
              label={common.choice.otherLabel}
              value={POLL_OTHER_ANSWER_ID}
              checked={selectedAnswerIds.includes(POLL_OTHER_ANSWER_ID)}
              onChange={(checked) => {
                onSelectedAnswerIdsChange(
                  toggleChoiceSelection({
                    question,
                    selectedAnswerIds,
                    value: POLL_OTHER_ANSWER_ID,
                    checked,
                  }),
                );
              }}
            />
            {selectedAnswerIds.includes(POLL_OTHER_ANSWER_ID) ? (
              <input
                type='text'
                className='w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900'
                placeholder={common.choice.otherPlaceholder}
                value={otherText}
                onChange={(event) => onOtherTextChange(event.target.value)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

interface ChoiceControlProps {
  question: PollChoiceQuestion;
  inputId: string;
  label: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ChoiceControl({
  question,
  inputId,
  label,
  value,
  checked,
  onChange,
}: ChoiceControlProps) {
  const inputType = question.selectionMode === 'single' ? 'radio' : 'checkbox';
  const name = question.selectionMode === 'single' ? question.id : undefined;

  return (
    <label
      htmlFor={inputId}
      className='flex cursor-pointer items-start gap-3 rounded-lg border border-neutral-200 px-3 py-2'
    >
      <input
        id={inputId}
        type={inputType}
        name={name}
        className='mt-1 h-4 w-4 shrink-0'
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        value={value}
      />
      <span className='text-base text-neutral-900'>{label}</span>
    </label>
  );
}

function toggleChoiceSelection({
  question,
  selectedAnswerIds,
  value,
  checked,
}: {
  question: PollChoiceQuestion;
  selectedAnswerIds: string[];
  value: string;
  checked: boolean;
}): string[] {
  if (question.selectionMode === 'single') {
    return checked ? [value] : [];
  }
  if (checked) {
    return selectedAnswerIds.includes(value)
      ? selectedAnswerIds
      : [...selectedAnswerIds, value];
  }
  return selectedAnswerIds.filter((id) => id !== value);
}
