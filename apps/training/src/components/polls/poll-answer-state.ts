export interface QuestionAnswerState {
  selectedOption: string;
  trueFalseValue: boolean | null;
  freeText: string;
}

export function emptyAnswerState(): QuestionAnswerState {
  return {
    selectedOption: '',
    trueFalseValue: null,
    freeText: '',
  };
}

import type { PollQuestion } from '@/content/poll-types';

export function isAnswerValid(question: PollQuestion, answer: QuestionAnswerState): boolean {
  if (question.type === 'select') {
    return answer.selectedOption.trim().length > 0;
  }
  if (question.type === 'truefalse') {
    return answer.trueFalseValue !== null;
  }
  if (question.type === 'email') {
    return isValidEmail(answer.freeText);
  }
  if (question.type === 'text') {
    return answer.freeText.trim().length > 0;
  }
  return false;
}

function isValidEmail(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
