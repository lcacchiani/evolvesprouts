'use client';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import type { QuestionAnswerState } from '@/components/polls/poll-answer-state';

export interface PollAnswerPanelProps {
  question: PollQuestion;
  common: PollsCommonContent;
  answer: QuestionAnswerState;
}

export function PollAnswerPanel({ question, common, answer }: PollAnswerPanelProps) {
  if (question.type === 'truefalse') {
    const isCorrect = answer.trueFalseValue === question.answer;
    return (
      <section className='flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4'>
        <h2 className='text-lg font-semibold text-neutral-900'>
          {isCorrect ? common.truefalse.correctHeading : common.truefalse.incorrectHeading}
        </h2>
        <p className='text-base text-neutral-800'>{question.answerNote}</p>
      </section>
    );
  }

  if (question.type === 'select') {
    const lines: string[] = [];
    if (question.presenterNote) {
      lines.push(question.presenterNote);
    }
    if (answer.selectedOption) {
      lines.push(
        common.results.yourAnswerTemplate.replace('{answer}', answer.selectedOption),
      );
    }
    return (
      <section className='flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4'>
        {lines.map((line) => (
          <p key={line} className='text-base text-neutral-800'>
            {line}
          </p>
        ))}
      </section>
    );
  }

  return null;
}
