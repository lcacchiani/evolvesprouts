'use client';

import type { PollQuestion, PollsCommonContent } from '@/content/poll-types';
import type { QuestionAnswerState } from '@/components/polls/poll-answer-state';

const POLL_PANEL_CLASS =
  'flex flex-col gap-3 rounded-inner border es-border-panel-soft es-bg-surface-muted p-4';

export interface PollAnswerPanelProps {
  question: PollQuestion;
  common: PollsCommonContent;
  answer: QuestionAnswerState;
}

export function PollAnswerPanel({ question, common, answer }: PollAnswerPanelProps) {
  if (question.type === 'truefalse') {
    const isCorrect = answer.trueFalseValue === question.answer;
    return (
      <section className={POLL_PANEL_CLASS}>
        <h2 className='es-text-heading text-lg font-semibold'>
          {isCorrect ? common.truefalse.correctHeading : common.truefalse.incorrectHeading}
        </h2>
        <p className='es-text-body text-base'>{question.answerNote}</p>
      </section>
    );
  }

  if (question.type === 'select' || question.type === 'multiselect') {
    const lines: string[] = [];
    if (question.presenterNote) {
      lines.push(question.presenterNote);
    }
    const selectedLabels =
      question.type === 'select'
        ? answer.selectedOption
          ? [answer.selectedOption]
          : []
        : answer.selectedOptions;
    for (const label of selectedLabels) {
      lines.push(common.results.yourAnswerTemplate.replace('{answer}', label));
    }
    return (
      <section className={POLL_PANEL_CLASS}>
        {lines.map((line) => (
          <p key={line} className='es-text-body text-base'>
            {line}
          </p>
        ))}
      </section>
    );
  }

  return null;
}
